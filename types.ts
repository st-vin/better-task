export interface Goal {
    id: string;
    title: string;
    description: string;
    type: 'habit' | 'resolution';
    createdAt: number;
    status: 'active' | 'completed' | 'archived';
    completedDate?: number;
    color?: string;
    icon?: string;
}

export interface DailyTask {
    id: string;
    goalId: string;
    title: string;
    description?: string;
    daysOfWeek: number[]; // 0=Sunday, 6=Saturday
    startTime: string; // "HH:MM" 24-hour format
    endTime: string; // "HH:MM" 24-hour format
    reminderMinutes?: number;
    createdAt: number;
}

export interface FreeTask {
    id: string;
    title: string;
    description?: string;
    dueDate?: number;
    dueTime?: string;
    isCompleted: boolean;
    completedAt?: number;
    reminderMinutes?: number;
    createdAt: number;
}

export interface TaskCompletion {
    id: string;
    taskId: string;
    goalId?: string;
    completedAt: number;
    date: string; // "YYYY-MM-DD"
    notes?: string;
}

export interface StudentUnit {
    id: string;
    name: string;
    code: string;
    semester: string;
    credits: number;
    status: 'active' | 'completed' | 'archived';
    completedDate?: number;
    instructor?: string;
    schedule: DailyTask[];
    exams: Exam[];
}

export interface Exam {
    id: string;
    unitId: string;
    title: string;
    date: number;
    time: string;
    location?: string;
    topics: string[];
}

export interface PluginSettings {
    notificationsEnabled: boolean;
    streakWarningDays: number;
    reminderSound: boolean;
    studentMode: boolean;
    hasSeenWelcome: boolean;
}

export interface PluginData {
    goals: Goal[];
    dailyTasks: DailyTask[];
    freeTasks: FreeTask[];
    completions: TaskCompletion[];
    studentUnits: StudentUnit[];
    settings: PluginSettings;
}

// Undo/Redo Support — state snapshots for undo/redo (shape varies by action)
export type UndoRedoState = Record<string, unknown>;

export interface UndoRedoEntry {
    action: string;
    previousState: UndoRedoState;
    timestamp: number;
}

/** Obsidian App extensions not in public .d.ts (e.g. commands) */
export interface AppWithCommands {
    commands: { executeCommandById(id: string): void };
}

// Advanced Analytics Types
export interface ConsistencyScore {
    score: number;
    tier: string;
    message: string;
}

export interface DayOfWeekStats {
    day: string;
    dayIndex: number;
    completionCount: number;
    completionRate: number;
}

export interface DayOfWeekAnalysis {
    dayStats: DayOfWeekStats[];
    strongest: string;
    weakest: string;
    suggestion: string;
}

export interface MomentumData {
    direction: string;
    trend: string;
    change: number;
}

export interface GoalDifficultyRanking {
    goal: Goal;
    completionRate: number;
    rank: string;
    scheduled: number;
    completed: number;
}

export interface StreakBreakerData {
    commonDay: string;
    averageStreakLength: number;
    tip: string;
    breakCount: number;
}

export interface WeekData {
    weekStart: string;
    count: number;
}

export interface BestWorstWeeks {
    best: WeekData | null;
    worst: WeekData | null;
}

export interface StreakRisk {
    risk: string;
    color: string;
    message: string;
}

export interface OptimalTiming {
    bestHours: number[];
    message: string;
}

export interface DailyForecast {
    onTrack: boolean;
    message: string;
    confidence: number;
    tasksRemaining: number;
    hoursRemaining: number;
}
