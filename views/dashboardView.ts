
import { ItemView, WorkspaceLeaf, Notice, setIcon, moment, Menu, EventRef } from 'obsidian';
import BetterTaskPlugin from '../main';
import { AppWithCommands } from '../types';
import { GoalModal } from '../modals/goalModal';
import { GoalDetailsModal } from '../modals/goalDetailsModal';
import { ConfirmModal } from '../modals/confirmModal';

export const DASHBOARD_VIEW_TYPE = 'better-task-dashboard';

export class DashboardView extends ItemView {
    plugin: BetterTaskPlugin;
    showAllExams: boolean = false;
    currentCalendarMonth: Date = new Date();
    selectedCalendarDay: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: BetterTaskPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return DASHBOARD_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Better task';
    }

    getIcon(): string {
        return 'check-circle';
    }

    onOpen(): Promise<void> {
        this.render();
        // Refresh view when data changes
        this.registerEvent((this.plugin.app.workspace as { on(name: string, callback: () => void): EventRef }).on('better-task:data-change', () => {
            this.render();
        }));
        return Promise.resolve();
    }

    async onClose() {
        // Cleanup
    }

    render() {
        const container = this.containerEl.children[1];
        container.empty();

        // Create a wrapper for the centered layout and content
        const wrapper = container.createEl('div', { cls: 'better-task-dashboard' });

        this.renderHeader(wrapper as HTMLElement);
        this.renderActionButtons(wrapper as HTMLElement);

        this.renderTodaysTasks(wrapper as HTMLElement);

        // Conditionally render Student Mode sections if enabled
        if (this.plugin.data.settings.studentMode) {
            try {
                this.renderStudentMode(wrapper as HTMLElement);
            } catch (error) {
                console.error('Error rendering student mode:', error);
                const errorSection = wrapper.createEl('div', { cls: 'dashboard-section' });
                errorSection.createEl('h2', { text: '🎓 Student dashboard' });
                errorSection.createEl('p', {
                    text: 'Error loading student mode. Please check console for details.',
                    cls: 'error-message'
                });
            }
        }

        this.renderQuickTasks(wrapper as HTMLElement);
        this.renderGoalsOverview(wrapper as HTMLElement);
        this.renderCalendar(wrapper as HTMLElement);
        this.renderAnalytics(wrapper as HTMLElement);
    }

    renderHeader(container: HTMLElement) {
        const headerEl = container.createEl('div', { cls: 'dashboard-header' });
        headerEl.createEl('h1', { text: 'Better task dashboard' });
        headerEl.createEl('h3', { text: moment().format('dddd, MMMM Do YYYY') });
    }

    renderTodaysTasks(container: HTMLElement) {
        const section = container.createEl('div', { cls: 'dashboard-section' });
        section.createEl('h2', { text: "Today's tasks" });

        const { dailyTasks } = this.plugin.taskManager.getTasksForToday();

        // Filter out completed free tasks for this section? 
        // The plan says "For each daily task scheduled for today"
        // And "For each incomplete free task" is in Quick Tasks section.
        // So this section is mainly for Daily Tasks?
        // "For each daily task scheduled for today: ... Checkbox... Task title..."

        if (dailyTasks.length === 0) {
            const emptyState = section.createEl('div', { cls: 'empty-state-with-action' });
            emptyState.createEl('p', { text: '📅 No daily tasks scheduled for today.' });
            emptyState.createEl('p', { text: 'Daily tasks are recurring activities linked to your goals.', cls: 'empty-hint' });
            const btn = emptyState.createEl('button', { text: '+ Create daily task', cls: 'empty-action-btn' });
            btn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-daily-task');
            });
            return;
        }

        const list = section.createEl('div', { cls: 'task-list' });

        dailyTasks.forEach(task => {
            const taskEl = list.createEl('div', { cls: 'task-item' });

            const isCompleted = this.plugin.taskManager.isTaskCompletedToday(task.id);
            if (isCompleted) taskEl.addClass('completed');

            const checkbox = taskEl.createEl('input', { type: 'checkbox' });
            checkbox.checked = isCompleted;
            checkbox.addEventListener('change', () => {
                void (async () => {
                    if (checkbox.checked) {
                        await this.plugin.taskManager.completeTask(task.id, task.goalId);
                        this.render();
                    } else {
                        await this.plugin.taskManager.uncompleteTask(task.id);
                        this.render();
                    }
                })();
            });

            const content = taskEl.createEl('div', { cls: 'task-content' });
            content.createEl('span', { text: task.title, cls: 'task-title' });
            content.createEl('span', { text: `${task.startTime} - ${task.endTime}`, cls: 'task-time' });

            const goal = this.plugin.data.goals.find(g => g.id === task.goalId);
            if (goal) {
                content.createEl('span', { text: goal.title, cls: 'goal-tag' });
            }
        });
    }

    renderQuickTasks(container: HTMLElement) {
        const section = container.createEl('div', { cls: 'dashboard-section' });
        section.createEl('h2', { text: 'Quick tasks' });

        const incompleteFreeTasks = this.plugin.data.freeTasks.filter(t => !t.isCompleted);

        if (incompleteFreeTasks.length === 0) {
            const emptyState = section.createEl('div', { cls: 'empty-state-with-action' });
            emptyState.createEl('p', { text: '✅ No pending quick tasks.' });
            emptyState.createEl('p', { text: 'Quick tasks are one-off to-dos you need to complete.', cls: 'empty-hint' });
            const btn = emptyState.createEl('button', { text: '+ Create quick task', cls: 'empty-action-btn' });
            btn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-free-task');
            });
            return;
        }

        const list = section.createEl('div', { cls: 'task-list' });

        incompleteFreeTasks.forEach(task => {
            const taskEl = list.createEl('div', { cls: 'task-item' });

            const checkbox = taskEl.createEl('input', { type: 'checkbox' });
            checkbox.checked = false;
            checkbox.addEventListener('change', () => {
                void (async () => {
                    if (checkbox.checked) {
                        await this.plugin.taskManager.completeTask(task.id);
                        this.render();
                    } else {
                        await this.plugin.taskManager.uncompleteTask(task.id);
                        this.render();
                    }
                })();
            });

            const content = taskEl.createEl('div', { cls: 'task-content' });
            content.createEl('span', { text: task.title, cls: 'task-title' });
            if (task.dueTime) {
                content.createEl('span', { text: `Due: ${task.dueTime}`, cls: 'task-time' });
            }
        });
    }

    renderGoalsOverview(container: HTMLElement) {
        const section = container.createEl('div', { cls: 'dashboard-section' });
        section.createEl('h2', { text: 'Your goals' });

        if (this.plugin.data.goals.length === 0) {
            const emptyState = section.createEl('div', { cls: 'empty-state-with-action' });
            emptyState.createEl('p', { text: 'No goals yet. Let\'s get started!' });
            emptyState.createEl('p', { text: 'Goals are long-term habits or resolutions you want to track.', cls: 'empty-hint' });
            const btn = emptyState.createEl('button', { text: '+ Create your first goal', cls: 'empty-action-btn primary' });
            btn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-goal');
            });
            return;
        }

        const grid = section.createEl('div', { cls: 'goals-grid' });

        const activeGoals = this.plugin.data.goals.filter(g => (g.status || 'active') === 'active');

        if (activeGoals.length === 0 && this.plugin.data.goals.length > 0) {
            section.createEl('p', { text: 'All goals are completed or archived. Great job! 🎉', cls: 'empty-hint' });
            return;
        }

        activeGoals.forEach(goal => {
            const card = grid.createEl('div', { cls: 'goal-card interactive-card' });

            // Borders are now subtle in CSS, we just handle the color accent if needed
            if (goal.color) {
                card.style.borderTop = `2px solid ${goal.color}`;
            }

            card.addEventListener('click', () => {
                new GoalDetailsModal(this.plugin, goal).open();
            });

            // Add context menu for goal card
            card.addEventListener('contextmenu', (event: MouseEvent) => {
                const menu = new Menu();

                menu.addItem((item) => {
                    item.setTitle('Mark as complete')
                        .setIcon('check')
                        .onClick(() => {
                            void this.plugin.goalManager.markGoalAsCompleted(goal.id);
                        });
                });

                menu.addItem((item) => {
                    item.setTitle('Archive')
                        .setIcon('archive')
                        .onClick(() => {
                            void this.plugin.goalManager.archiveGoal(goal.id);
                        });
                });

                menu.addSeparator();

                menu.addItem((item) => {
                    item.setTitle('Edit goal')
                        .setIcon('pencil')
                        .onClick(() => {
                            new GoalModal(this.plugin.app, (result) => {
                                void this.plugin.goalManager.editGoal(goal.id, result);
                            }, { title: goal.title, description: goal.description }).open();
                        });
                });

                menu.addItem((item) => {
                    item.setTitle('Delete goal')
                        .setIcon('trash')
                        .onClick(() => {
                            new ConfirmModal(this.plugin.app, `Delete "${goal.title}"?`, () => {
                                void this.plugin.goalManager.deleteGoal(goal.id);
                            }).open();
                        });
                });

                menu.showAtMouseEvent(event);
            });

            const header = card.createEl('div', { cls: 'goal-card-header' });
            header.createEl('h3', { text: goal.title });

            const consistency = this.plugin.analyticsManager.getCompletionRateByGoal(goal.id);
            const healthBar = card.createEl('div', { cls: 'mini-health-bar' });
            const fill = healthBar.createEl('div', { cls: 'mini-health-fill' });

            let colorClass = 'health-low';
            if (consistency >= 80) colorClass = 'health-high';
            else if (consistency >= 50) colorClass = 'health-medium';
            fill.addClass(colorClass);
            fill.style.width = `${Math.max(consistency, 5)}%`;

            const footer = card.createEl('div', { cls: 'goal-card-footer' });
            const streak = this.plugin.goalManager.getGoalStreak(goal.id);
            if (streak > 0) {
                footer.createEl('span', { text: `🔥 ${streak}`, cls: 'streak-count' });
            }
            footer.createEl('span', { text: `${Math.round(consistency)}%`, cls: 'health-percent' });

            // Action Buttons (Hidden by default in CSS, shown on hover)
            const actions = card.createEl('div', { cls: 'goal-actions' });

            const editBtn = actions.createEl('button', { cls: 'goal-action-btn' });
            setIcon(editBtn, 'pencil');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new GoalModal(
                    this.plugin.app,
                    (result) => {
                        void this.plugin.goalManager.editGoal(goal.id, result);
                    },
                    { title: goal.title, description: goal.description }
                ).open();
            });

            const completeBtn = actions.createEl('button', { cls: 'goal-action-btn' });
            setIcon(completeBtn, 'check');
            completeBtn.setAttr('title', 'Mark as complete');
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                void this.plugin.goalManager.markGoalAsCompleted(goal.id);
            });

            const deleteBtn = actions.createEl('button', { cls: 'goal-action-btn' });
            setIcon(deleteBtn, 'trash');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new ConfirmModal(this.plugin.app, `Delete "${goal.title}"?`, () => {
                    void this.plugin.goalManager.deleteGoal(goal.id);
                }).open();
            });
        });
    }

    renderAnalytics(container: HTMLElement) {
        const section = container.createEl('details', { cls: 'dashboard-section analytics-section' });
        section.setAttribute('open', '');
        const summary = section.createEl('summary');
        summary.createEl('h2', { text: 'Insights and analytics', cls: 'inline-header' });

        // Primary Metrics
        const statsGrid = section.createEl('div', { cls: 'stats-grid' });

        // Weekly Success Rate (Consistent Days)
        const successCard = statsGrid.createEl('div', { cls: 'stat-card' });
        successCard.createEl('h4', { text: 'Weekly score' });
        const successRate = this.plugin.analyticsManager.getWeeklySuccessRate();
        successCard.createEl('div', { text: `${successRate}%`, cls: 'stat-value' });
        successCard.createEl('div', { text: 'Consistency', cls: 'stat-label' });

        // Longest Streak
        const streakCard = statsGrid.createEl('div', { cls: 'stat-card' });
        streakCard.createEl('h4', { text: 'Best streak' });
        const longestStreak = this.plugin.analyticsManager.getLongestStreakEver();
        streakCard.createEl('div', { text: `${longestStreak} 🔥`, cls: 'stat-value' });
        streakCard.createEl('div', { text: 'All-time record', cls: 'stat-label' });

        // Active Focus (Most active goal)
        const attentionCard = statsGrid.createEl('div', { cls: 'stat-card focus-card' });
        attentionCard.createEl('h4', { text: 'Recent focus' });
        const activeGoal = this.plugin.analyticsManager.getMostActiveGoal();
        if (activeGoal) {
            attentionCard.createEl('div', { text: activeGoal.title, cls: 'stat-value goal-name' });
            attentionCard.createEl('div', { text: 'Most active this week', cls: 'stat-label' });
        } else {
            attentionCard.createEl('div', { text: 'N/A', cls: 'stat-value' });
            attentionCard.createEl('div', { text: 'Start your week', cls: 'stat-label' });
        }

        // Activity Comparison Visual
        const activityHistory = this.plugin.analyticsManager.getActivityHistory(7);
        const activitySection = section.createEl('div', { cls: 'activity-comparison-section' });

        const activityHeader = activitySection.createDiv({ cls: 'activity-header-row' });
        activityHeader.createEl('h4', { text: 'Activity comparison' });

        // Legend
        const legend = activityHeader.createDiv({ cls: 'chart-legend' });
        const createdLeg = legend.createDiv({ cls: 'legend-item' });
        createdLeg.createDiv({ cls: 'legend-color created' });
        createdLeg.createEl('span', { text: 'Created' });

        const completedLeg = legend.createDiv({ cls: 'legend-item' });
        completedLeg.createDiv({ cls: 'legend-color completed' });
        completedLeg.createEl('span', { text: 'Completed' });

        const chart = activitySection.createEl('div', { cls: 'activity-chart' });

        const maxVal = Math.max(...activityHistory.map(h => Math.max(h.created, h.completed)), 1);

        activityHistory.forEach((day, i) => {
            const group = chart.createEl('div', { cls: 'bar-group' });

            // Created bar
            const createdContainer = group.createDiv({ cls: 'bar-container created' });
            const cHeight = (day.created / maxVal) * 100;
            const cBar = createdContainer.createDiv({ cls: 'bar created' });
            cBar.style.height = `${Math.max(cHeight, 2)}%`;

            // Completed bar
            const completedContainer = group.createDiv({ cls: 'bar-container completed' });
            const compHeight = (day.completed / maxVal) * 100;
            const compBar = completedContainer.createDiv({ cls: 'bar completed' });
            compBar.style.height = `${Math.max(compHeight, 2)}%`;

            if (i === 6) group.addClass('is-today');
        });

    }


    renderActionButtons(container: HTMLElement) {
        const section = container.createEl('div', { cls: 'dashboard-actions' });

        const newGoalBtn = section.createEl('button', { text: '+ New goal' });
        newGoalBtn.addEventListener('click', () => {
            // Call command or open modal directly
            // Accessing internal command or modal
            (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-goal');
        });

        const newQuickTaskBtn = section.createEl('button', { text: '+ Quick task' });
        newQuickTaskBtn.addEventListener('click', () => {
            (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-free-task');
        });

        const newDailyTaskBtn = section.createEl('button', { text: '+ Daily task' });
        newDailyTaskBtn.addEventListener('click', () => {
            (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-daily-task');
        });

        // Student Mode buttons
        if (this.plugin.data.settings.studentMode) {
            const newUnitBtn = section.createEl('button', { text: '🎓 New unit' });
            newUnitBtn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-unit');
            });

            const addExamBtn = section.createEl('button', { text: '📝 Add exam' });
            addExamBtn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:add-exam');
            });
        }
    }

    renderStudentMode(container: HTMLElement) {
        const studentSection = container.createEl('details', { cls: 'dashboard-section student-mode-section' });
        studentSection.setAttribute('open', '');
        const summary = studentSection.createEl('summary');
        summary.createEl('h2', { text: 'Student dashboard', cls: 'inline-header' });

        this.renderStudentContent(studentSection);
    }

    renderStudentContent(container: HTMLElement) {
        const section = container.createEl('div', { cls: 'student-subsection' });
        section.createEl('h3', { text: 'Current semester units' });
        this.renderUnitsGrid(section);
        section.createEl('h3', { text: 'Upcoming exams (next 30 days)', cls: 'exams-heading' });
        this.renderExamsList(section);
    }

    renderUnitsGrid(container: HTMLElement) {
        const currentUnits = this.plugin.studentManager.getCurrentSemesterUnits();

        if (currentUnits.length === 0) {
            const emptyState = container.createEl('div', { cls: 'empty-state-with-action' });
            emptyState.createEl('p', { text: '📚 No units registered this semester.' });
            emptyState.createEl('p', { text: 'Create units to track your courses and exams.', cls: 'empty-hint' });
            const btn = emptyState.createEl('button', { text: '+ Create first unit', cls: 'empty-action-btn' });
            btn.addEventListener('click', () => {
                (this.plugin.app as unknown as AppWithCommands).commands.executeCommandById('better-task:create-unit');
            });
            return;
        }

        const grid = container.createEl('div', { cls: 'units-grid' });

        currentUnits.forEach(unit => {
            const card = grid.createEl('div', { cls: 'unit-card' });

            // Add context menu for unit card
            card.addEventListener('contextmenu', (event: MouseEvent) => {
                const menu = new Menu();

                menu.addItem((item) => {
                    item.setTitle('Mark as complete')
                        .setIcon('check')
                        .onClick(() => {
                            void this.plugin.studentManager.markUnitAsCompleted(unit.id);
                        });
                });

                menu.addItem((item) => {
                    item.setTitle('Archive')
                        .setIcon('archive')
                        .onClick(() => {
                            void this.plugin.studentManager.archiveUnit(unit.id);
                        });
                });

                menu.addSeparator();

                menu.addItem((item) => {
                    item.setTitle('Delete unit')
                        .setIcon('trash')
                        .onClick(() => {
                            new ConfirmModal(this.plugin.app, `Delete "${unit.name}"?`, () => {
                                void this.plugin.studentManager.deleteUnit(unit.id);
                            }).open();
                        });
                });

                menu.showAtMouseEvent(event);
            });

            const header = card.createEl('div', { cls: 'unit-header' });
            header.createEl('h4', { text: unit.name });
            header.createEl('span', { text: unit.code, cls: 'unit-code' });

            if (unit.instructor) {
                card.createEl('div', { text: unit.instructor, cls: 'unit-instructor' });
            }

            card.createEl('div', { text: `Credits: ${unit.credits}`, cls: 'unit-credits' });

            const examCount = unit.exams.length;
            if (examCount > 0) {
                card.createEl('div', { text: `📝 ${examCount} exam${examCount !== 1 ? 's' : ''}`, cls: 'unit-exams-count' });
            }

            // Bottom Actions
            const actions = card.createEl('div', { cls: 'unit-actions', attr: { style: 'display: flex; gap: 8px; margin-top: 10px;' } });

            // Add exam button for this unit
            const addExamBtn = actions.createEl('button', { text: '+ Exam', cls: 'unit-action-btn' });
            addExamBtn.addEventListener('click', () => {
                void (async () => {
                    try {
                        const { ExamModal } = await import('../modals/examModal');
                        new ExamModal(this.plugin.app, unit, (examData) => {
                            void (async () => {
                                const exam = await this.plugin.studentManager.addExam(unit.id, examData);
                                if (exam) {
                                    new Notice(`Exam "${exam.title}" added to ${unit.name}!`);
                                    this.render();
                                }
                            })();
                        }).open();
                    } catch (error) {
                        console.error('Error opening ExamModal:', error);
                        new Notice('Failed to open exam form. Check console for details.');
                    }
                })();
            });

            const completeBtn = actions.createEl('button', { text: 'Complete', cls: 'unit-action-btn' });
            completeBtn.addEventListener('click', () => {
                void this.plugin.studentManager.markUnitAsCompleted(unit.id);
            });
        });
    }

    renderExamsList(container: HTMLElement) {
        const toggleContainer = container.createEl('div', { cls: 'exam-horizon-toggle', attr: { style: 'margin-bottom: 15px; display: flex; align-items: center; gap: 8px; font-size: 0.9em; color: var(--text-muted);' } });
        const toggle = toggleContainer.createEl('input', { type: 'checkbox' });
        toggle.checked = this.showAllExams;
        toggle.addEventListener('change', () => {
            this.showAllExams = toggle.checked;
            this.render();
        });
        toggleContainer.createEl('span', { text: 'Show all upcoming exams (beyond 30 days)' });

        const daysLookup = this.showAllExams ? 365 : 30;
        const upcomingExams = this.plugin.studentManager.getUpcomingExams(daysLookup);

        if (upcomingExams.length === 0) {
            container.createEl('p', { text: `✅ No upcoming exams in the next ${daysLookup} days.`, cls: 'empty-state-text' });
            return;
        }

        const list = container.createEl('div', { cls: 'exams-list' });

        upcomingExams.forEach(exam => {
            const examInfo = this.plugin.studentManager.getExamById(exam.id);
            if (!examInfo) return;

            const { unit } = examInfo;

            const card = list.createEl('div', { cls: 'exam-card' });

            // Flex header
            const header = card.createEl('div', { cls: 'exam-header' });
            const titleGroup = header.createDiv();
            titleGroup.createEl('h4', { text: exam.title });
            titleGroup.createEl('span', { text: unit.code, cls: 'exam-unit-code' });

            // Countdown Badge
            const daysUntil = this.plugin.studentManager.getDaysUntilExam(exam);
            const badgeClass = daysUntil <= 7 ? 'urgent' : 'normal';
            header.createDiv({ text: `${daysUntil} days left`, cls: `countdown-badge ${badgeClass}` });

            // Helper to get formatted date
            const examDate = new Date(exam.date);
            const dateStr = examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            card.createDiv({ text: `${dateStr} at ${exam.time}`, cls: 'exam-date-sub' });

            // Bottom Actions
            const footer = card.createDiv({ cls: 'exam-footer' });

            const studyBtn = footer.createEl('button', { text: 'Generate plan', cls: 'study-tasks-btn' });
            studyBtn.addEventListener('click', () => {
                void (async () => {
                    try {
                        const tasks = await this.plugin.studentManager.generateStudyTasks(exam.id);
                        new Notice(`Generated ${tasks.length} study task${tasks.length !== 1 ? 's' : ''} for ${exam.title}!`);
                        this.render();
                    } catch (error) {
                        console.error('Error generating study tasks:', error);
                        new Notice('Failed to generate study tasks. Check console for details.');
                    }
                })();
            });
        });
    }


    renderCalendar(container: HTMLElement) {
        const section = container.createEl('details', { cls: 'dashboard-section' });
        section.setAttribute('open', '');
        const summary = section.createEl('summary');
        summary.createEl('h2', { text: '📅 Calendar', cls: 'inline-header' });

        const year = this.currentCalendarMonth.getFullYear();
        const month = this.currentCalendarMonth.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        // Header with nav
        const header = section.createEl('div', { cls: 'calendar-header' });
        const prevBtn = header.createEl('button', { text: '◀', cls: 'calendar-nav-btn' });
        header.createEl('h3', { text: `${monthNames[month]} ${year}` });
        const nextBtn = header.createEl('button', { text: '▶', cls: 'calendar-nav-btn' });

        prevBtn.addEventListener('click', () => {
            this.currentCalendarMonth = new Date(year, month - 1, 1);
            this.selectedCalendarDay = null;
            this.render();
        });
        nextBtn.addEventListener('click', () => {
            this.currentCalendarMonth = new Date(year, month + 1, 1);
            this.selectedCalendarDay = null;
            this.render();
        });

        // Build calendar data
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Gather events for this month
        const dailyTasks = this.plugin.data.dailyTasks;
        const freeTasks = this.plugin.data.freeTasks;
        const allExams: { title: string; date: number; time: string; unitCode?: string }[] = [];
        for (const unit of this.plugin.data.studentUnits) {
            for (const exam of unit.exams) {
                allExams.push({ title: exam.title, date: exam.date, time: exam.time, unitCode: unit.code });
            }
        }

        // Helper: get items for a specific date
        const getItemsForDate = (dateStr: string, dayOfWeek: number) => {
            const items: { type: string; label: string; time?: string }[] = [];

            // Daily tasks that occur on this day of week
            for (const dt of dailyTasks) {
                if (dt.daysOfWeek.includes(dayOfWeek)) {
                    // Check associated goal status (default to 'active' for backward compatibility)
                    const goal = this.plugin.data.goals.find(g => g.id === dt.goalId);
                    const status = goal?.status || 'active';
                    if (!goal || status !== 'active') continue;

                    // Check creation date to avoid showing tasks for past days
                    const createdMoment = moment(dt.createdAt);
                    const checkMoment = moment(dateStr);

                    if (checkMoment.isBefore(createdMoment, 'day')) continue;

                    if (checkMoment.isSame(createdMoment, 'day')) {
                        // If same day as creation, check if task time has already passed
                        const taskEndTime = parseInt(dt.endTime.replace(':', ''));
                        const creationTime = createdMoment.hour() * 100 + createdMoment.minute();
                        if (creationTime >= taskEndTime) continue;
                    }

                    items.push({ type: 'daily', label: dt.title, time: `${dt.startTime}–${dt.endTime}` });
                }
            }
            // Free tasks due on this day
            for (const ft of freeTasks) {
                if (ft.dueDate) {
                    const ftStr = moment(ft.dueDate).format('YYYY-MM-DD');
                    if (ftStr === dateStr) {
                        items.push({ type: 'free', label: ft.title, time: ft.dueTime || undefined });
                    }
                }
            }
            // Exams on this day
            for (const ex of allExams) {
                const exStr = moment(ex.date).format('YYYY-MM-DD');
                if (exStr === dateStr) {
                    items.push({ type: 'exam', label: `${ex.title}${ex.unitCode ? ' (' + ex.unitCode + ')' : ''}`, time: ex.time });
                }
            }
            return items;
        };

        // Grid
        const grid = section.createEl('div', { cls: 'calendar-grid' });
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (const dh of dayHeaders) {
            grid.createEl('div', { text: dh, cls: 'calendar-day-header' });
        }

        // Leading blanks from previous month
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            const cell = grid.createEl('div', { cls: 'calendar-day other-month' });
            cell.createEl('span', { text: String(prevMonthDays - i), cls: 'calendar-day-number' });
        }

        // Actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const items = getItemsForDate(dateStr, dayOfWeek);

            const cls = ['calendar-day'];
            if (dateStr === todayStr) cls.push('today');
            if (dateStr === this.selectedCalendarDay) cls.push('selected');

            const cell = grid.createEl('div', { cls: cls.join(' ') });
            cell.createEl('span', { text: String(day), cls: 'calendar-day-number' });

            // Dots
            if (items.length > 0) {
                const dots = cell.createEl('div', { cls: 'calendar-dots' });
                const hasDailyTask = items.some(i => i.type === 'daily');
                const hasFreeTask = items.some(i => i.type === 'free');
                const hasExam = items.some(i => i.type === 'exam');
                if (hasDailyTask) dots.createEl('span', { cls: 'calendar-dot task' });
                if (hasFreeTask) dots.createEl('span', { cls: 'calendar-dot free' });
                if (hasExam) dots.createEl('span', { cls: 'calendar-dot exam' });
            }

            cell.addEventListener('click', () => {
                this.selectedCalendarDay = dateStr;
                this.render();
            });
        }

        // Trailing blanks
        const totalCells = firstDay + daysInMonth;
        const trailing = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= trailing; i++) {
            const cell = grid.createEl('div', { cls: 'calendar-day other-month' });
            cell.createEl('span', { text: String(i), cls: 'calendar-day-number' });
        }

        // Detail panel for selected day
        if (this.selectedCalendarDay) {
            const parts = this.selectedCalendarDay.split('-');
            const selDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const selDayOfWeek = selDate.getDay();
            const items = getItemsForDate(this.selectedCalendarDay, selDayOfWeek);

            const detail = section.createEl('div', { cls: 'calendar-day-detail' });
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            detail.createEl('div', {
                text: `${dayNames[selDayOfWeek]}, ${monthNames[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}, ${parts[0]}`,
                cls: 'calendar-detail-header'
            });

            if (items.length === 0) {
                detail.createEl('div', { text: 'Nothing scheduled for this day.', cls: 'calendar-detail-empty' });
            } else {
                for (const item of items) {
                    const row = detail.createEl('div', { cls: 'calendar-detail-item' });
                    const badgeCls = item.type === 'daily' ? 'daily' : item.type === 'free' ? 'free' : 'exam';
                    const badgeLabel = item.type === 'daily' ? 'TASK' : item.type === 'free' ? 'TODO' : 'EXAM';
                    row.createEl('span', { text: badgeLabel, cls: `cal-type-badge ${badgeCls}` });
                    row.createEl('span', { text: item.label });
                    if (item.time) {
                        row.createEl('span', { text: item.time, cls: 'task-time' });
                    }
                }
            }
        }
    }

}
