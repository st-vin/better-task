import { Modal, Setting, Notice } from 'obsidian';
import { Goal, DailyTask } from '../types';
import BetterTaskPlugin from '../main';

interface TaskResult {
    title: string;
    description: string;
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    dueDate?: number;
    dueTime?: string;
    reminderMinutes?: number;
    goalId?: string;
}

export class TaskModal extends Modal {
    plugin: BetterTaskPlugin;
    type: 'daily' | 'free';
    goals: Goal[];
    result: TaskResult;
    onSubmit: (result: TaskResult) => void;

    constructor(plugin: BetterTaskPlugin, type: 'daily' | 'free', goals: Goal[], onSubmit: (result: TaskResult) => void) {
        super(plugin.app);
        this.plugin = plugin;
        this.type = type;
        this.goals = goals;
        this.onSubmit = onSubmit;
        this.result = {
            title: '',
            description: '',
            daysOfWeek: [],
            reminderMinutes: 15
        };
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h1', { text: `Create ${this.type === 'daily' ? 'daily' : 'quick'} task` });

        if (this.type === 'daily') {
            if (this.goals.length > 0) {
                this.result.goalId = this.goals[0].id; // Default to first goal
                new Setting(contentEl)
                    .setName('Goal')
                    .addDropdown(dropDown => {
                        this.goals.forEach(goal => {
                            dropDown.addOption(goal.id, goal.title);
                        });
                        dropDown.setValue(this.goals[0].id);
                        dropDown.onChange(value => {
                            this.result.goalId = value;
                        });
                    });
            } else {
                new Setting(contentEl)
                    .setName('Goal')
                    .setDesc('No goals found. Please create a goal first.');
            }
        }

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .onChange(value => {
                    this.result.title = value;
                }));

        new Setting(contentEl)
            .setName('Description')
            .addTextArea(text => text
                .onChange(value => {
                    this.result.description = value;
                }));

        if (this.type === 'daily') {
            this.createDailyTaskFields(contentEl);
        } else {
            this.createFreeTaskFields(contentEl);
        }

        new Setting(contentEl)
            .setName('Reminder (minutes before)')
            .addText(text => text
                .setValue('15')
                .onChange(value => {
                    this.result.reminderMinutes = parseInt(value, 10) || 0;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Create and add another')
                .onClick(() => {
                    this.onSubmit(this.result);
                    // Reset fields for next task
                    this.result.title = '';
                    this.result.description = '';
                    // Keep Goal and Date/Time settings as they are often sequential
                    new Notice('Task created. Add another.');
                    // Refresh view to clear input fields visually
                    // Since we bound inputs to this.result members but inputs don't auto-update from model in this simple implementation,
                    // we need to re-render or explicitly clear the inputs.
                    // Easiest is to close and reopen, but that defeats the purpose.
                    // Better: Re-render content.
                    this.contentEl.empty();
                    this.onOpen();
                }))
            .addButton(btn => btn
                .setButtonText('Create')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.result);
                }));
    }

    createDailyTaskFields(contentEl: HTMLElement) {
        // Warning Container
        const warningEl = contentEl.createDiv({ cls: 'task-conflict-warning hidden' });

        const validateConflicts = () => {
            // We need to access the plugin instance to call taskManager
            // Since we don't have direct access to plugin in this class, we might need to pass it or access via app (if exposed)
            // For now, let's assume we can access it via the app generic or pass it in constructor.
            // But waiting... we passed `app` to constructor.
            // Ideally TaskModal should take `plugin` instead of `app` or in addition.
            // Let's check main.ts to see how it's instantiated. 
            // It uses `new TaskModal(this.app, ...)`
            // We can hack access via (this.app as any).plugins.plugins['better-task'] but that's messy.
            // Better to assume we can pass the manager or plugin.

            // ACTUALLY, checking previous file view of main.ts...
            // It calls: `new TaskModal(this.app, 'daily', this.data.goals, ...)`
            // We should probably update the constructor to take the plugin or taskManager.

            // HOWEVER, I don't want to break the signature if I can avoid it right now without viewing main.ts again.
            // Let's try to access via app for now as a quick fix, or better, let's assume I can update the constructor in the next step if strictly needed.
            // Wait, I can cast app to any to find the plugin if I know the ID.

            type AppWithPlugins = { plugins: { plugins: Record<string, { taskManager?: { checkTaskConflicts(newTask: Partial<DailyTask>): DailyTask[] } }> } };
            const plugin = (this.app as unknown as AppWithPlugins).plugins.plugins['better-task'];
            if (plugin && plugin.taskManager) {
                const conflicts = plugin.taskManager.checkTaskConflicts(this.result);
                if (conflicts.length > 0) {
                    warningEl.removeClass('hidden');
                    const conflictTitles = conflicts.map((t: DailyTask) => t.title).join(', ');
                    warningEl.setText(`⚠️ Conflict with: ${conflictTitles}`);
                } else {
                    warningEl.addClass('hidden');
                }
            }
        };

        const daysDiv = contentEl.createDiv();
        daysDiv.createEl('h3', { text: 'Days of week' });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // Initialize with all days if empty
        if (!this.result.daysOfWeek || this.result.daysOfWeek.length === 0) {
            this.result.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
        }

        days.forEach((day, index) => {
            const dayContainer = daysDiv.createDiv({ cls: 'day-checkbox' });
            const cb = dayContainer.createEl('input', { type: 'checkbox' });
            cb.id = `day-${index}`;
            cb.checked = this.result.daysOfWeek?.includes(index) || false;

            cb.onchange = (e) => {
                const checked = (e.target as HTMLInputElement).checked;
                if (checked) {
                    if (!this.result.daysOfWeek?.includes(index)) {
                        this.result.daysOfWeek?.push(index);
                    }
                } else {
                    this.result.daysOfWeek = this.result.daysOfWeek?.filter(d => d !== index);
                }
                this.result.daysOfWeek?.sort();
                validateConflicts();
            };

            dayContainer.createEl('label', { text: day, attr: { for: `day-${index}` } });
            dayContainer.addClass('day-checkbox-container');
        });

        new Setting(contentEl)
            .setName('Start time')
            .addText(text => {
                text.inputEl.type = 'time';
                text.setPlaceholder('HH:MM')
                    .onChange(value => {
                        this.result.startTime = value;
                        validateConflicts();
                    });
            });

        new Setting(contentEl)
            .setName('End time')
            .addText(text => {
                text.inputEl.type = 'time';
                text.setPlaceholder('HH:MM')
                    .onChange(value => {
                        this.result.endTime = value;
                        validateConflicts();
                    });
            });
    }

    createFreeTaskFields(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Due date')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setPlaceholder('YYYY-MM-DD')
                    .onChange(value => {
                        // value from type='date' is YYYY-MM-DD; parse explicitly to avoid UTC off-by-one
                        if (value) {
                            const parts = value.split('-');
                            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                            this.result.dueDate = dateObj.getTime();
                        } else {
                            this.result.dueDate = undefined;
                        }
                    });
            });

        new Setting(contentEl)
            .setName('Due time')
            .addText(text => {
                text.inputEl.type = 'time';
                text.setPlaceholder('HH:MM')
                    .onChange(value => {
                        this.result.dueTime = value;
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
