
import { DailyTask, FreeTask, TaskCompletion } from './types';
import BetterTaskPlugin from './main';
import { Notice, moment } from 'obsidian';

export class TaskManager {
    private plugin: BetterTaskPlugin;

    constructor(plugin: BetterTaskPlugin) {
        this.plugin = plugin;
    }

    async createDailyTask(goalId: string, taskData: Partial<DailyTask>): Promise<DailyTask> {
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newTask: DailyTask = {
            id,
            goalId,
            title: taskData.title || 'New Task',
            description: taskData.description,
            daysOfWeek: taskData.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
            startTime: taskData.startTime || '09:00',
            endTime: taskData.endTime || '10:00',
            reminderMinutes: taskData.reminderMinutes,
            createdAt: Date.now()
        };

        // Save to undo stack before adding
        this.plugin.saveToUndoStack('daily_task_created', { taskId: id });

        this.plugin.data.dailyTasks.push(newTask);
        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Daily task created successfully!');
        return newTask;
    }

    async createFreeTask(taskData: Partial<FreeTask>): Promise<FreeTask> {
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newTask: FreeTask = {
            id,
            title: taskData.title || 'New Task',
            description: taskData.description,
            dueDate: taskData.dueDate,
            dueTime: taskData.dueTime,
            isCompleted: false,
            reminderMinutes: taskData.reminderMinutes,
            createdAt: Date.now()
        };

        // Save to undo stack before adding
        this.plugin.saveToUndoStack('free_task_created', { taskId: id });

        this.plugin.data.freeTasks.push(newTask);
        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Task created successfully!');
        return newTask;
    }

    async completeTask(taskId: string, goalId?: string, notes?: string): Promise<void> {
        // Save to undo stack before completing
        const freeTaskBefore = this.plugin.data.freeTasks.find(t => t.id === taskId);
        this.plugin.saveToUndoStack('task_completed', {
            taskId,
            freeTask: freeTaskBefore ? { ...freeTaskBefore } : null
        });

        const completion: TaskCompletion = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            taskId,
            goalId,
            completedAt: Date.now(),
            date: new Date().toISOString().split('T')[0],
            notes
        };

        this.plugin.data.completions.push(completion);

        const freeTask = this.plugin.data.freeTasks.find(t => t.id === taskId);
        if (freeTask) {
            freeTask.isCompleted = true;
            freeTask.completedAt = Date.now();
        }

        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Task completed! 🎉');
    }

    async uncompleteTask(taskId: string): Promise<void> {
        const today = new Date().toISOString().split('T')[0];

        // Find if it was completed today
        const completionIndex = this.plugin.data.completions.findIndex(
            c => c.taskId === taskId && c.date === today
        );

        if (completionIndex !== -1) {
            this.plugin.data.completions.splice(completionIndex, 1);
        }

        const freeTask = this.plugin.data.freeTasks.find(t => t.id === taskId);
        if (freeTask) {
            freeTask.isCompleted = false;
            freeTask.completedAt = undefined;
        }

        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Task marked as incomplete.');
    }

    getTasksForToday(): { dailyTasks: DailyTask[], freeTasks: FreeTask[] } {
        const now = moment();
        const dayOfWeek = now.day(); // 0-6
        const dateString = now.format('YYYY-MM-DD');
        const currentTime = now.hour() * 100 + now.minute();

        const dailyTasks = this.plugin.data.dailyTasks.filter(task => {
            // Check if day of week matches
            if (!task.daysOfWeek.includes(dayOfWeek)) return false;

            // Check if associated goal is active (default to 'active' for backward compatibility)
            const goal = this.plugin.data.goals.find(g => g.id === task.goalId);
            const status = goal?.status || 'active';
            if (!goal || status !== 'active') return false;

            // Check creation date to avoid show tasks for past days
            const createdMoment = moment(task.createdAt);

            if (now.isBefore(createdMoment, 'day')) return false; // Task created in the future?

            if (now.isSame(createdMoment, 'day')) {
                // If created today, check if task time has already passed
                const taskEndTime = parseInt(task.endTime.replace(':', ''));
                if (currentTime >= taskEndTime) return false;
            }

            return true;
        });

        const freeTasks = this.plugin.data.freeTasks.filter(task =>
            !task.isCompleted &&
            (!task.dueDate || moment(task.dueDate).format('YYYY-MM-DD') === dateString)
        );

        return { dailyTasks, freeTasks };
    }

    isTaskCompletedToday(taskId: string): boolean {
        const today = new Date().toISOString().split('T')[0];
        return this.plugin.data.completions.some(c =>
            c.taskId === taskId && c.date === today
        );
    }

    checkTaskConflicts(newTask: Partial<DailyTask>): DailyTask[] {
        if (!newTask.daysOfWeek || !newTask.startTime || !newTask.endTime) {
            return [];
        }

        const newStart = parseInt(newTask.startTime.replace(':', ''));
        const newEnd = parseInt(newTask.endTime.replace(':', ''));

        return this.plugin.data.dailyTasks.filter(existingTask => {
            // Skip if it's the same task (for editing scenarios, though currently we only create)
            if (existingTask.id === newTask.id) return false;

            // Check if days overlap
            const daysOverlap = existingTask.daysOfWeek.some(day => newTask.daysOfWeek?.includes(day));
            if (!daysOverlap) return false;

            // Check if times overlap
            const existingStart = parseInt(existingTask.startTime.replace(':', ''));
            const existingEnd = parseInt(existingTask.endTime.replace(':', ''));

            // Overlap logic: (StartA < EndB) and (EndA > StartB)
            return (newStart < existingEnd) && (newEnd > existingStart);
        });
    }
}
