import { Notice, Platform } from 'obsidian';
import BetterTaskPlugin from './main';
import { subtractMinutes, getCurrentTime } from './utils/timeUtils';
import { getDateString } from './utils/dateUtils';

export class NotificationManager {
    plugin: BetterTaskPlugin;
    notifiedTasks: Set<string>;
    notifiedGoals: Set<string>;
    checkInterval: number | null;

    constructor(plugin: BetterTaskPlugin) {
        this.plugin = plugin;
        this.notifiedTasks = new Set();
        this.notifiedGoals = new Set();
        this.checkInterval = null;
        this.requestNotificationPermission();
    }

    requestNotificationPermission() {
        if (!Platform.isDesktop) return;

        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                }
            });
        }
    }

    startBackgroundCheck() {
        // Run immediately
        this.checkReminders();
        this.checkStreaks();

        // Then every minute
        this.checkInterval = window.setInterval(() => {
            this.checkReminders();
            this.checkStreaks();
        }, 60000);
    }

    stopBackgroundCheck() {
        if (this.checkInterval) {
            window.clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkReminders() {
        if (!this.plugin.data.settings.notificationsEnabled) return;

        const now = getCurrentTime();
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0-6
        const todayStr = getDateString(today);

        // Check daily tasks
        this.plugin.data.dailyTasks.forEach(task => {
            if (task.daysOfWeek.includes(dayOfWeek)) {
                if (task.reminderMinutes) {
                    const reminderTime = subtractMinutes(task.startTime, task.reminderMinutes);
                    const notificationKey = `${task.id}_${todayStr}`;

                    if (now === reminderTime && !this.notifiedTasks.has(notificationKey)) {
                        this.sendTaskReminder(task.title, `Starting in ${task.reminderMinutes} minutes`);
                        this.notifiedTasks.add(notificationKey);
                    }
                }
            }
        });

        // Check free tasks
        this.plugin.data.freeTasks.forEach(task => {
            if (!task.isCompleted && task.dueDate && task.dueTime && task.reminderMinutes) {
                const taskDueDate = new Date(task.dueDate);
                const taskDateStr = getDateString(taskDueDate);

                if (taskDateStr === todayStr) {
                    const reminderTime = subtractMinutes(task.dueTime, task.reminderMinutes);

                    if (now === reminderTime && !this.notifiedTasks.has(task.id)) {
                        this.sendTaskReminder(task.title, `Due in ${task.reminderMinutes} minutes`);
                        this.notifiedTasks.add(task.id);
                    }
                }
            }
        });
    }

    checkStreaks() {
        if (!this.plugin.data.settings.notificationsEnabled) return;

        const now = new Date();
        // Only check at 8 PM (20:00)
        if (now.getHours() !== 20) return;

        const todayStr = getDateString(now);
        const checkKey = `checked_streaks_${todayStr}`;
        if (this.notifiedGoals.has(checkKey)) return;

        this.plugin.data.goals.forEach(goal => {
            // Skip if archived
            if (goal.status === 'archived') return;

            let daysInvalid = this.plugin.goalManager.getDaysSinceLastCompletion(goal.id);

            // Handle case where never completed
            if (daysInvalid === -1) {
                const createdDate = new Date(goal.createdAt);
                const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                daysInvalid = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            if (daysInvalid >= this.plugin.data.settings.streakWarningDays) {
                this.sendStreakWarning(goal.title, daysInvalid);
            }
        });

        this.notifiedGoals.add(checkKey);
    }

    sendTaskReminder(title: string, message: string) {
        new Notice(`⏰ ${title}: ${message}`);

        if (this.plugin.data.settings.reminderSound) {
            this.playNotificationSound();
        }

        if (Notification.permission === 'granted') {
            new Notification('Better Task Reminder', {
                body: `${title}: ${message}`,
                icon: 'check-circle'
            });
        }
    }

    sendStreakWarning(goalTitle: string, daysMissed: number) {
        const msg = `You haven't completed '${goalTitle}' in ${daysMissed} days!`;
        new Notice(`⚠️ ${msg}`, 10000);

        if (this.plugin.data.settings.reminderSound) {
            this.playNotificationSound();
        }

        if (Notification.permission === 'granted') {
            new Notification('Better Task Streak Warning', {
                body: msg,
                requireInteraction: true,
                icon: 'alert-triangle'
            });
        }
    }

    playNotificationSound() {
        // Placeholder for sound implementation
        // const audio = new Audio('path/to/sound.mp3');
        // audio.play().catch(e => console.error(e));
    }
}
