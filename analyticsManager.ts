import BetterTaskPlugin from './main';
import { Goal } from './types';
import { getDateString } from './utils/dateUtils';

export interface CompletionHeatmapData {
    date: string;
    count: number;
}

export class AnalyticsManager {
    plugin: BetterTaskPlugin;

    constructor(plugin: BetterTaskPlugin) {
        this.plugin = plugin;
    }

    /**
     * Get total completions from the past N days
     */
    getWeeklyCompletions(): number {
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        return this.plugin.data.completions.filter(c =>
            c.completedAt >= sevenDaysAgo
        ).length;
    }

    /**
     * Calculate completion rate for a specific goal over the past 30 days
     * Returns percentage (0-100)
     */
    getCompletionRateByGoal(goalId: string): number {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        // Get all daily tasks for this goal
        const dailyTasks = this.plugin.data.dailyTasks.filter(t => t.goalId === goalId);

        if (dailyTasks.length === 0) return 0;

        // Calculate expected completions in past 30 days
        let expectedCompletions = 0;
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dayOfWeek = checkDate.getDay();

            // Count how many tasks were scheduled for this day
            dailyTasks.forEach(task => {
                if (task.daysOfWeek.includes(dayOfWeek)) {
                    expectedCompletions++;
                }
            });
        }

        if (expectedCompletions === 0) return 0;

        // Count actual completions
        const actualCompletions = this.plugin.data.completions.filter(c =>
            c.goalId === goalId && c.completedAt >= thirtyDaysAgo
        ).length;

        return Math.round((actualCompletions / expectedCompletions) * 100);
    }

    /**
     * Find the goal with the highest current streak
     */
    getMostConsistentGoal(): Goal | null {
        if (this.plugin.data.goals.length === 0) return null;

        let bestGoal: Goal | null = null;
        let maxStreak = 0;

        this.plugin.data.goals.forEach(goal => {
            const streak = this.plugin.goalManager.getGoalStreak(goal.id);
            if (streak > maxStreak) {
                maxStreak = streak;
                bestGoal = goal;
            }
        });

        return maxStreak > 0 ? bestGoal : null;
    }

    /**
     * Find the goal with the most days since last completion
     */
    getGoalNeedingAttention(): Goal | null {
        if (this.plugin.data.goals.length === 0) return null;

        let needsAttention: Goal | null = null;
        let maxDays = 0;

        this.plugin.data.goals.forEach(goal => {
            const daysSince = this.plugin.goalManager.getDaysSinceLastCompletion(goal.id);
            if (daysSince > maxDays) {
                maxDays = daysSince;
                needsAttention = goal;
            }
        });

        return maxDays > 0 ? needsAttention : null;
    }

    /**
     * Get completion count for each day in the past N days
     * Returns array of {date, count} objects for heatmap visualization
     */
    getCompletionHeatmap(days: number): CompletionHeatmapData[] {
        const heatmapData: CompletionHeatmapData[] = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = getDateString(checkDate);

            const count = this.plugin.data.completions.filter(c =>
                c.date === dateStr
            ).length;

            heatmapData.push({ date: dateStr, count });
        }

        return heatmapData;
    }

    /**
     * Get the longest streak ever achieved across all goals
     */
    getLongestStreakEver(): number {
        let maxStreak = 0;

        this.plugin.data.goals.forEach(goal => {
            const completions = this.plugin.data.completions
                .filter(c => c.goalId === goal.id)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let currentStreak = 0;
            let previousDate: Date | null = null;

            completions.forEach(completion => {
                const completionDate = new Date(completion.date);

                if (!previousDate) {
                    currentStreak = 1;
                } else {
                    const dayDiff = Math.floor((completionDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (dayDiff === 1) {
                        currentStreak++;
                    } else {
                        maxStreak = Math.max(maxStreak, currentStreak);
                        currentStreak = 1;
                    }
                }

                previousDate = completionDate;
            });

            maxStreak = Math.max(maxStreak, currentStreak);
        });

        return maxStreak;
    }

    /**
     * Get percentage of days in the last 7 days with at least one completion
     */
    getWeeklySuccessRate(): number {
        const today = new Date();
        let successfulDays = 0;

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = getDateString(checkDate);

            const hasCompletion = this.plugin.data.completions.some(c => c.date === dateStr);
            if (hasCompletion) successfulDays++;
        }

        return Math.round((successfulDays / 7) * 100);
    }

    /**
     * Get creation and completion counts for each of the last 7 days
     */
    getActivityHistory(days: number = 7): { date: string, created: number, completed: number }[] {
        const history: { date: string, created: number, completed: number }[] = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = getDateString(checkDate);

            // Count created (Daily + Free)
            const created = [
                ...this.plugin.data.dailyTasks,
                ...this.plugin.data.freeTasks
            ].filter(t => getDateString(new Date(t.createdAt)) === dateStr).length;

            // Count completed (recorded in completions)
            const completed = this.plugin.data.completions.filter(c => c.date === dateStr).length;

            history.push({ date: dateStr, created, completed });
        }

        return history;
    }

    /**
     * Find the goal with the most completions in the last 7 days
     */
    getMostActiveGoal(): Goal | null {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const goalCounts: Record<string, number> = {};

        this.plugin.data.completions
            .filter(c => c.completedAt >= sevenDaysAgo && c.goalId)
            .forEach(c => {
                if (c.goalId) {
                    goalCounts[c.goalId] = (goalCounts[c.goalId] || 0) + 1;
                }
            });

        let mostActiveId = null;
        let maxCount = 0;

        for (const [id, count] of Object.entries(goalCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostActiveId = id;
            }
        }

        return mostActiveId ? this.plugin.data.goals.find(g => g.id === mostActiveId) || null : null;
    }
}
