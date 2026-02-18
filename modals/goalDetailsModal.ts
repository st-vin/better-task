import { Modal } from 'obsidian';
import { Goal, DailyTask } from '../types';
import BetterTaskPlugin from '../main';
import { GoalModal } from './goalModal';
import { TaskModal } from './taskModal';

export class GoalDetailsModal extends Modal {
    plugin: BetterTaskPlugin;
    goal: Goal;
    tasks: DailyTask[];

    constructor(plugin: BetterTaskPlugin, goal: Goal) {
        super(plugin.app);
        this.plugin = plugin;
        this.goal = goal;
        this.tasks = this.plugin.data.dailyTasks.filter(t => t.goalId === goal.id);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('goal-details-modal');

        // Header Section
        const header = contentEl.createDiv({ cls: 'goal-dashboard-header' });
        header.createEl('h2', { text: this.goal.title });
        if (this.goal.description) {
            header.createEl('p', { text: this.goal.description, cls: 'goal-desc-muted' });
        }

        // Layout Container
        const layout = contentEl.createDiv({ cls: 'goal-dashboard-layout' });

        // Sidebar: Stats & Health
        const sidebar = layout.createDiv({ cls: 'goal-dashboard-sidebar' });
        const consistency = this.plugin.analyticsManager ? this.plugin.analyticsManager.getCompletionRateByGoal(this.goal.id) : 0;
        const streak = this.plugin.goalManager.getGoalStreak(this.goal.id);

        const healthCircle = sidebar.createDiv({ cls: 'goal-health-ring' });
        healthCircle.createDiv({ text: `${Math.round(consistency)}%`, cls: 'health-value' });
        healthCircle.createDiv({ text: 'consistency', cls: 'health-label' });

        // Color based on consistency
        if (consistency >= 80) healthCircle.addClass('health-high');
        else if (consistency >= 50) healthCircle.addClass('health-medium');
        else healthCircle.addClass('health-low');

        const statsList = sidebar.createDiv({ cls: 'goal-mini-stats' });
        const streakStat = statsList.createDiv({ cls: 'mini-stat' });
        streakStat.createEl('span', { text: 'Streak' });
        streakStat.createEl('strong', { text: `${streak}d` });
        const daysSince = this.plugin.goalManager.getDaysSinceLastCompletion(this.goal.id);
        const lastActiveStat = statsList.createDiv({ cls: 'mini-stat' });
        lastActiveStat.createEl('span', { text: 'Last Active' });
        lastActiveStat.createEl('strong', { text: daysSince === 0 ? 'Today' : `${daysSince}d ago` });

        // Main Content: Tasks
        const main = layout.createDiv({ cls: 'goal-dashboard-main' });
        main.createEl('h3', { text: 'Daily Schedule' });
        const taskList = main.createDiv({ cls: 'goal-task-list-modern' });

        if (this.tasks.length === 0) {
            taskList.createEl('p', { text: 'No recurring tasks for this goal.', cls: 'empty-hint' });
        } else {
            this.tasks.forEach(task => {
                const item = taskList.createDiv({ cls: 'goal-task-item' });
                const info = item.createDiv({ cls: 'task-item-info' });
                info.createEl('div', { text: task.title, cls: 'task-title' });
                info.createEl('div', { text: `${task.startTime} - ${task.endTime}`, cls: 'task-time' });

                const days = item.createDiv({ cls: 'task-days-row' });
                ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => {
                    const day = days.createEl('span', { text: d, cls: 'day-bubble' });
                    if (task.daysOfWeek.includes(i)) day.addClass('active');
                });
            });
        }

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'goal-dashboard-footer' });

        const addTaskBtn = footer.createEl('button', { text: '+ New daily task', cls: 'mod-cta' });
        addTaskBtn.onclick = () => {
            this.close();
            new TaskModal(this.plugin, 'daily', [this.goal], (result) => {
                if (result.goalId) {
                    void this.plugin.taskManager.createDailyTask(result.goalId, result);
                }
            }).open();
        };

        const editBtn = footer.createEl('button', { text: 'Edit goal' });
        editBtn.onclick = () => {
            this.close();
            new GoalModal(this.app, (result: { title: string; description: string }) => {
                void this.plugin.goalManager.editGoal(this.goal.id, result);
            }, { title: this.goal.title, description: this.goal.description }).open();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
