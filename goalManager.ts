import { Goal } from './types';
import BetterTaskPlugin from './main';
import { Notice } from 'obsidian';

export class GoalManager {
    private plugin: BetterTaskPlugin;

    constructor(plugin: BetterTaskPlugin) {
        this.plugin = plugin;
    }

    async createGoal(title: string, description: string): Promise<Goal> {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const newGoal: Goal = {
            id,
            title,
            description,
            type: 'habit', // Defaulting to habit if not provided, though types.ts says it's required
            createdAt: Date.now(),
            status: 'active'
        };

        // Save to undo stack before adding
        this.plugin.saveToUndoStack('goal_created', { goalId: id });

        this.plugin.data.goals.push(newGoal);
        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Goal created successfully!');
        return newGoal;
    }

    async editGoal(goalId: string, updates: Partial<Goal>): Promise<Goal | null> {
        const goalIndex = this.plugin.data.goals.findIndex(g => g.id === goalId);
        if (goalIndex === -1) return null;

        const originalGoal = { ...this.plugin.data.goals[goalIndex] };

        // Save to undo stack (simplified for now, just storing the whole goal)
        // In a real app, you might want more granular undo for edits
        this.plugin.saveToUndoStack('goal_edited', { goal: originalGoal });

        const updatedGoal = { ...originalGoal, ...updates };
        this.plugin.data.goals[goalIndex] = updatedGoal;

        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Goal updated!');
        return updatedGoal;
    }

    async deleteGoal(goalId: string): Promise<void> {
        // Save to undo stack before deleting
        const goal = this.plugin.data.goals.find(g => g.id === goalId);
        const tasks = this.plugin.data.dailyTasks.filter(t => t.goalId === goalId);

        if (goal) {
            this.plugin.saveToUndoStack('goal_deleted', {
                goal: { ...goal },
                tasks: tasks.map(t => ({ ...t }))
            });
        }

        this.plugin.data.goals = this.plugin.data.goals.filter(g => g.id !== goalId);
        // Also remove associated daily tasks
        this.plugin.data.dailyTasks = this.plugin.data.dailyTasks.filter(t => t.goalId !== goalId);
        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');
        new Notice('Goal deleted.');
    }

    async markGoalAsCompleted(goalId: string): Promise<void> {
        const goal = this.plugin.data.goals.find(g => g.id === goalId);
        if (goal) {
            goal.status = 'completed';
            goal.completedDate = Date.now();
            await this.plugin.savePluginData();
            this.plugin.app.workspace.trigger('better-task:data-change');
            new Notice(`Goal "${goal.title}" marked as completed! 🎉`);
        }
    }

    async archiveGoal(goalId: string): Promise<void> {
        const goal = this.plugin.data.goals.find(g => g.id === goalId);
        if (goal) {
            goal.status = 'archived';
            await this.plugin.savePluginData();
            this.plugin.app.workspace.trigger('better-task:data-change');
            new Notice(`Goal "${goal.title}" archived.`);
        }
    }

    getGoalStreak(goalId: string): number {
        const completions = this.plugin.data.completions
            .filter(c => c.goalId === goalId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (completions.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // precise date handling needed here.
        // Simplified logic: check consecutive days backwards from today or yesterday.
        // If completed today, streak includes today.

        let currentDate = new Date(today);

        // Check if completed today
        const completedToday = completions.some(c => c.date === currentDate.toISOString().split('T')[0]);
        if (!completedToday) {
            // Check if completed yesterday
            currentDate.setDate(currentDate.getDate() - 1);
            const completedYesterday = completions.some(c => c.date === currentDate.toISOString().split('T')[0]);
            if (!completedYesterday) {
                return 0;
            }
        }

        // Iterate backwards
        // Reset current date to start checking
        // If completed today, start checking from today. If not, start from yesterday (which we confirmed exists)

        currentDate = new Date(today);
        if (!completedToday) {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        while (true) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const hasCompletion = completions.some(c => c.date === dateStr);
            if (hasCompletion) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    getDaysSinceLastCompletion(goalId: string): number {
        const completions = this.plugin.data.completions
            .filter(c => c.goalId === goalId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (completions.length === 0) return -1; // Never completed

        const lastCompletion = completions[0];
        const lastDate = new Date(lastCompletion.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate difference in days
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }
}
