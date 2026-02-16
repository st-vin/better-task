import { App, Plugin, PluginSettingTab, Setting, Notice, WorkspaceLeaf, FuzzySuggestModal } from 'obsidian';
import { PluginData, PluginSettings, UndoRedoEntry, UndoRedoState, Goal, DailyTask, FreeTask, StudentUnit } from './types';
import { GoalManager } from './goalManager';
import { TaskManager } from './taskManager';
import { GoalModal } from './modals/goalModal';
import { TaskModal } from './modals/taskModal';
import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/dashboardView';
import { NotificationManager } from './notificationManager';
import { AnalyticsManager } from './analyticsManager';

import { StudentManager } from './studentManager';
import { UnitModal } from './modals/unitModal';
import { ExamModal } from './modals/examModal';
import { WelcomeModal } from './modals/welcomeModal';

const DEFAULT_SETTINGS: PluginSettings = {
    notificationsEnabled: true,
    streakWarningDays: 3,
    reminderSound: true,
    studentMode: true,
    hasSeenWelcome: false
};

const DEFAULT_DATA: PluginData = {
    goals: [],
    dailyTasks: [],
    freeTasks: [],
    completions: [],
    studentUnits: [],
    settings: DEFAULT_SETTINGS
};

export default class BetterTaskPlugin extends Plugin {
    data: PluginData;
    goalManager: GoalManager;
    taskManager: TaskManager;
    notificationManager: NotificationManager;
    analyticsManager: AnalyticsManager;

    studentManager: StudentManager;

    // Undo/Redo stacks (in-memory only, not persisted)
    undoStack: UndoRedoEntry[] = [];
    redoStack: UndoRedoEntry[] = [];

    async onload() {
        console.log('Loading Better Task plugin');

        await this.loadPluginData();

        // Initialize Managers
        this.goalManager = new GoalManager(this);
        this.taskManager = new TaskManager(this);
        this.notificationManager = new NotificationManager(this);
        this.analyticsManager = new AnalyticsManager(this);

        this.studentManager = new StudentManager(this);
        this.notificationManager.startBackgroundCheck();

        // Check for welcome modal
        if (!this.data.settings.hasSeenWelcome) {
            new WelcomeModal(this.app, async () => {
                this.data.settings.hasSeenWelcome = true;
                await this.savePluginData();
                this.activateView();
            }).open();
        }

        this.registerView(
            DASHBOARD_VIEW_TYPE,
            (leaf) => new DashboardView(leaf, this)
        );

        // This creates an icon in the left ribbon.
        this.addRibbonIcon('check-circle', 'Better Task', (evt: MouseEvent) => {
            this.activateView();
        });

        // Add settings tab
        this.addSettingTab(new BetterTaskSettingTab(this.app, this));

        // Register commands
        this.addCommand({
            id: 'open-dashboard',
            name: 'Open Dashboard',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'create-goal',
            name: 'Create New Goal',
            callback: () => {
                new GoalModal(this.app, async (result) => {
                    await this.goalManager.createGoal(result.title, result.description);
                }).open();
            }
        });

        this.addCommand({
            id: 'create-daily-task',
            name: 'Create Daily Task',
            callback: () => {
                if (this.data.goals.length === 0) {
                    new Notice('Please create a goal first!');
                    return;
                }

                new TaskModal(this, 'daily', this.data.goals, async (result) => {
                    if (result.goalId) {
                        // Ensure result.goalId is present
                        await this.taskManager.createDailyTask(result.goalId, result);
                    } else {
                        new Notice('No goal selected!');
                    }
                }).open();
            }
        });

        this.addCommand({
            id: 'create-free-task',
            name: 'Create Quick Task',
            callback: () => {
                new TaskModal(this, 'free', [], async (result) => {
                    await this.taskManager.createFreeTask(result);
                }).open();
            }
        });

        // Student Mode commands
        this.addCommand({
            id: 'create-unit',
            name: 'Create Unit/Course',
            callback: () => {
                if (!this.data.settings.studentMode) {
                    new Notice('Please enable Student Mode in settings first!');
                    return;
                }
                new UnitModal(this.app, async (unitData, shouldClose) => {
                    const unit = await this.studentManager.createUnit(unitData);
                    new Notice(`Unit "${unit.name}" created!`);
                    this.app.workspace.trigger('better-task:data-change');
                }).open();
            }
        });

        this.addCommand({
            id: 'add-exam',
            name: 'Add Exam',
            callback: () => {
                if (!this.data.settings.studentMode) {
                    new Notice('Please enable Student Mode in settings first!');
                    return;
                }
                if (this.data.studentUnits.length === 0) {
                    new Notice('Please create a unit first!');
                    return;
                }

                new UnitSuggestModal(this.app, this.data.studentUnits, (unit) => {
                    new ExamModal(this.app, unit, async (examData) => {
                        const exam = await this.studentManager.addExam(unit.id, examData);
                        if (exam) {
                            new Notice(`Exam "${exam.title}" added!`);
                            // Refresh logic handled by data change event or manual refresh if needed
                            this.app.workspace.trigger('better-task:data-change');
                        }
                    }).open();
                }).open();
            }
        });

        // Undo/Redo commands
        this.addCommand({
            id: 'undo-action',
            name: 'Undo',
            hotkeys: [{ modifiers: ['Mod'], key: 'z' }],
            callback: () => {
                this.undo();
            }
        });

        this.addCommand({
            id: 'redo-action',
            name: 'Redo',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'z' }],
            callback: () => {
                this.redo();
            }
        });
    }

    onunload() {
        console.log('Unloading Better Task plugin');
        this.notificationManager?.stopBackgroundCheck();
    }

    async loadPluginData() {
        this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());
    }

    async savePluginData() {
        await this.saveData(this.data);
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            leaf = workspace.getLeaf(true);
            await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
        }

        workspace.revealLeaf(leaf);
    }

    /**
     * Save current state to undo stack before making changes
     * Clears redo stack since new actions invalidate redo history
     */
    saveToUndoStack(action: string, previousState: UndoRedoState): void {
        const entry: UndoRedoEntry = {
            action,
            previousState,
            timestamp: Date.now()
        };

        this.undoStack.push(entry);

        // Limit undo stack to 20 items
        if (this.undoStack.length > 20) {
            this.undoStack.shift(); // Remove oldest
        }

        // Clear redo stack (new action invalidates redo)
        this.redoStack = [];
    }

    /**
     * Undo the last action
     */
    async undo(): Promise<void> {
        if (this.undoStack.length === 0) {
            new Notice('Nothing to undo');
            return;
        }

        const entry = this.undoStack.pop()!;

        // Save current state to redo stack
        const currentState = this.captureCurrentState(entry.action, entry.previousState);
        this.redoStack.push({
            action: entry.action,
            previousState: currentState,
            timestamp: Date.now()
        });

        // Restore previous state
        await this.restoreState(entry.action, entry.previousState);

        new Notice(`Undone: ${this.getActionLabel(entry.action)}`);
    }

    /**
     * Redo the last undone action
     */
    async redo(): Promise<void> {
        if (this.redoStack.length === 0) {
            new Notice('Nothing to redo');
            return;
        }

        const entry = this.redoStack.pop()!;

        // Save current state to undo stack
        const currentState = this.captureCurrentState(entry.action, entry.previousState);
        this.undoStack.push({
            action: entry.action,
            previousState: currentState,
            timestamp: Date.now()
        });

        // Restore state
        await this.restoreState(entry.action, entry.previousState);

        new Notice(`Redone: ${this.getActionLabel(entry.action)}`);
    }

    /**
     * Capture current state for redo
     */
    private captureCurrentState(action: string, previousState: UndoRedoState): UndoRedoState {
        switch (action) {
            case 'goal_created': {
                const goalId = previousState.goalId as string;
                const goal = this.data.goals.find(g => g.id === goalId);
                return { goal: goal ? { ...goal } : null };
            }
            case 'goal_deleted':
                return {}; // Goal doesn't exist in current state

            case 'daily_task_created': {
                const taskId = previousState.taskId as string;
                const task = this.data.dailyTasks.find(t => t.id === taskId);
                return { task: task ? { ...task } : null };
            }
            case 'free_task_created': {
                const freeTaskId = previousState.taskId as string;
                const freeTask = this.data.freeTasks.find(t => t.id === freeTaskId);
                return { freeTask: freeTask ? { ...freeTask } : null };
            }
            case 'task_completed': {
                const completionTaskId = previousState.taskId as string;
                const completion = this.data.completions.find(c => c.taskId === completionTaskId && c.date === new Date().toISOString().split('T')[0]);
                const completedFreeTask = previousState.freeTask ? this.data.freeTasks.find(t => t.id === completionTaskId) : null;
                return {
                    completion: completion ? { ...completion } : null,
                    freeTask: completedFreeTask ? { ...completedFreeTask } : null
                };
            }
            default:
                return {};
        }
    }

    /**
     * Restore state from undo/redo entry
     */
    private async restoreState(action: string, state: UndoRedoState): Promise<void> {
        const goalId = state.goalId as string | undefined;
        const goal = state.goal as Goal | undefined;
        const tasks = state.tasks as DailyTask[] | undefined;
        const taskId = state.taskId as string | undefined;
        const freeTask = state.freeTask as FreeTask | undefined;

        switch (action) {
            case 'goal_created':
                if (goalId) {
                    this.data.goals = this.data.goals.filter(g => g.id !== goalId);
                }
                break;

            case 'goal_deleted':
                if (goal) {
                    this.data.goals.push(goal);
                }
                if (tasks && Array.isArray(tasks)) {
                    this.data.dailyTasks.push(...tasks);
                }
                break;

            case 'daily_task_created':
                if (taskId) {
                    this.data.dailyTasks = this.data.dailyTasks.filter(t => t.id !== taskId);
                }
                break;

            case 'free_task_created':
                if (taskId) {
                    this.data.freeTasks = this.data.freeTasks.filter(t => t.id !== taskId);
                }
                break;

            case 'task_completed':
                if (taskId) {
                    const today = new Date().toISOString().split('T')[0];
                    this.data.completions = this.data.completions.filter(
                        c => !(c.taskId === taskId && c.date === today)
                    );
                    if (freeTask) {
                        const ft = this.data.freeTasks.find(t => t.id === taskId);
                        if (ft) {
                            ft.isCompleted = false;
                            ft.completedAt = undefined;
                        }
                    }
                }
                break;
        }

        await this.savePluginData();
        this.app.workspace.trigger('better-task:data-change');
    }

    /**
     * Get human-readable label for action
     */
    private getActionLabel(action: string): string {
        const labels: Record<string, string> = {
            'goal_created': 'Create goal',
            'goal_deleted': 'Delete goal',
            'daily_task_created': 'Create daily task',
            'free_task_created': 'Create quick task',
            'task_completed': 'Complete task'
        };
        return labels[action] || action;
    }
}

class BetterTaskSettingTab extends PluginSettingTab {
    plugin: BetterTaskPlugin;

    constructor(app: App, plugin: BetterTaskPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Better Task Settings' });

        new Setting(containerEl)
            .setName('Enable notifications')
            .setDesc('Show reminders for upcoming tasks')
            .addToggle(toggle => toggle
                .setValue(this.plugin.data.settings.notificationsEnabled)
                .onChange(async (value) => {
                    this.plugin.data.settings.notificationsEnabled = value;
                    await this.plugin.savePluginData();
                }));

        new Setting(containerEl)
            .setName('Notification sound')
            .setDesc('Play sound with notifications')
            .addToggle(toggle => toggle
                .setValue(this.plugin.data.settings.reminderSound)
                .onChange(async (value) => {
                    this.plugin.data.settings.reminderSound = value;
                    await this.plugin.savePluginData();
                }));

        new Setting(containerEl)
            .setName('Streak warning threshold')
            .setDesc('Show warning after missing this many days')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.data.settings.streakWarningDays)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.data.settings.streakWarningDays = value;
                    await this.plugin.savePluginData();
                }));

        new Setting(containerEl)
            .setName('Student Mode')
            .setDesc('Enable semester tracking and exam scheduling')
            .addToggle(toggle => toggle
                .setValue(this.plugin.data.settings.studentMode)
                .onChange(async (value) => {
                    this.plugin.data.settings.studentMode = value;
                    await this.plugin.savePluginData();
                    // Trigger data change to refresh dashboard immediately
                    this.plugin.app.workspace.trigger('better-task:data-change');
                }));
    }
}

class UnitSuggestModal extends FuzzySuggestModal<StudentUnit> {
    units: StudentUnit[];
    onChoose: (unit: StudentUnit) => void;

    constructor(app: App, units: StudentUnit[], onChoose: (unit: StudentUnit) => void) {
        super(app);
        this.units = units;
        this.onChoose = onChoose;
    }

    getItems(): StudentUnit[] {
        return this.units;
    }

    getItemText(unit: StudentUnit): string {
        return `${unit.code} - ${unit.name}`;
    }

    onChooseItem(unit: StudentUnit, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(unit);
    }
}

