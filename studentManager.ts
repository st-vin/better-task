import { StudentUnit, Exam, FreeTask } from './types';
import BetterTaskPlugin from './main';
import { Notice } from 'obsidian';

export class StudentManager {
    private plugin: BetterTaskPlugin;

    constructor(plugin: BetterTaskPlugin) {
        this.plugin = plugin;
    }

    /**
     * Create a new unit
     */
    async createUnit(unitData: Partial<StudentUnit>): Promise<StudentUnit> {
        const newUnit: StudentUnit = {
            id: this.generateId(),
            name: unitData.name || 'Untitled Unit',
            code: unitData.code || '',
            semester: unitData.semester || this.getCurrentSemester(),
            credits: unitData.credits || 0,
            status: 'active',
            instructor: unitData.instructor,
            schedule: unitData.schedule || [],
            exams: unitData.exams || [],
        };

        this.plugin.data.studentUnits.push(newUnit);
        await this.plugin.savePluginData();

        return newUnit;
    }

    /**
     * Delete a unit by ID
     */
    async deleteUnit(unitId: string): Promise<void> {
        const index = this.plugin.data.studentUnits.findIndex(u => u.id === unitId);
        if (index !== -1) {
            this.plugin.data.studentUnits.splice(index, 1);
            await this.plugin.savePluginData();
        }
    }

    /**
     * Add an exam to a unit
     */
    async addExam(unitId: string, examData: Partial<Exam>): Promise<Exam | null> {
        const unit = this.plugin.data.studentUnits.find(u => u.id === unitId);
        if (!unit) {
            return null;
        }

        const newExam: Exam = {
            id: this.generateId(),
            unitId: unitId,
            title: examData.title || 'Untitled Exam',
            date: examData.date || Date.now(),
            time: examData.time || '09:00',
            location: examData.location,
            topics: examData.topics || [],
        };

        unit.exams.push(newExam);
        await this.plugin.savePluginData();

        return newExam;
    }

    /**
     * Delete an exam by ID
     */
    async deleteExam(unitId: string, examId: string): Promise<void> {
        const unit = this.plugin.data.studentUnits.find(u => u.id === unitId);
        if (!unit) return;

        const examIndex = unit.exams.findIndex(e => e.id === examId);
        if (examIndex !== -1) {
            unit.exams.splice(examIndex, 1);
            await this.plugin.savePluginData();
        }
    }

    /**
     * Get upcoming exams within the next N days
     */
    getUpcomingExams(daysAhead: number = 30): Exam[] {
        if (!this.plugin.data.studentUnits) {
            return [];
        }

        const now = Date.now();
        const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);

        const allExams: Exam[] = [];
        for (const unit of this.plugin.data.studentUnits) {
            for (const exam of unit.exams) {
                if (exam.date >= now && exam.date <= futureDate) {
                    allExams.push(exam);
                }
            }
        }

        // Sort by date ascending
        return allExams.sort((a, b) => a.date - b.date);
    }

    /**
     * Get all units for the current semester
     */
    getCurrentSemesterUnits(): StudentUnit[] {
        if (!this.plugin.data.studentUnits) {
            return [];
        }
        const currentSemester = this.getCurrentSemester();
        return this.plugin.data.studentUnits.filter(u => u.semester === currentSemester && (u.status || 'active') === 'active');
    }

    async markUnitAsCompleted(unitId: string): Promise<void> {
        const unit = this.plugin.data.studentUnits.find(u => u.id === unitId);
        if (unit) {
            unit.status = 'completed';
            unit.completedDate = Date.now();
            await this.plugin.savePluginData();
            this.plugin.app.workspace.trigger('better-task:data-change');
            new Notice(`Unit "${unit.name}" marked as completed!`);
        }
    }

    async archiveUnit(unitId: string): Promise<void> {
        const unit = this.plugin.data.studentUnits.find(u => u.id === unitId);
        if (unit) {
            unit.status = 'archived';
            await this.plugin.savePluginData();
            this.plugin.app.workspace.trigger('better-task:data-change');
            new Notice(`Unit "${unit.name}" archived.`);
        }
    }

    /**
     * Get all units (for viewing all semesters)
     */
    getAllUnits(): StudentUnit[] {
        return this.plugin.data.studentUnits;
    }

    /**
     * Get unit by ID
     */
    getUnitById(unitId: string): StudentUnit | undefined {
        return this.plugin.data.studentUnits.find(u => u.id === unitId);
    }

    /**
     * Get exam by ID (searches across all units)
     */
    getExamById(examId: string): { unit: StudentUnit; exam: Exam } | null {
        if (!this.plugin.data.studentUnits) {
            return null;
        }
        for (const unit of this.plugin.data.studentUnits) {
            const exam = unit.exams.find(e => e.id === examId);
            if (exam) {
                return { unit, exam };
            }
        }
        return null;
    }

    /**
     * Generate study tasks for an exam
     * Creates free tasks for each topic 2-3 days before the exam
     */
    async generateStudyTasks(examId: string): Promise<FreeTask[]> {
        const examInfo = this.getExamById(examId);
        if (!examInfo) {
            return [];
        }

        const { unit, exam } = examInfo;
        const createdTasks: FreeTask[] = [];

        // Calculate days until exam
        const daysUntilExam = Math.floor((exam.date - Date.now()) / (24 * 60 * 60 * 1000));

        // If exam is too soon (less than 3 days), create tasks for today/tomorrow
        const studyDaysBefore = Math.min(daysUntilExam, 3);

        // Create a study task for each topic
        for (let i = 0; i < exam.topics.length; i++) {
            const topic = exam.topics[i];

            // Distribute topics across available study days
            const daysBeforeExam = Math.max(2, studyDaysBefore - (i % studyDaysBefore));
            const dueDate = exam.date - (daysBeforeExam * 24 * 60 * 60 * 1000);

            const studyTask: FreeTask = {
                id: this.generateId(),
                title: `Study: ${unit.name} - ${topic}`,
                description: `Prepare for ${exam.title} on ${new Date(exam.date).toLocaleDateString()}`,
                dueDate: dueDate,
                dueTime: '18:00', // Default study time
                isCompleted: false,
                reminderMinutes: 15,
                createdAt: Date.now(),
            };

            this.plugin.data.freeTasks.push(studyTask);
            createdTasks.push(studyTask);
        }

        await this.plugin.savePluginData();
        this.plugin.app.workspace.trigger('better-task:data-change');

        return createdTasks;
    }

    /**
     * Determine current semester based on the current date
     * Common semester pattern: Spring (Jan-May), Summer (Jun-Aug), Fall (Sep-Dec)
     */
    private getCurrentSemester(): string {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const year = now.getFullYear();

        if (month >= 0 && month <= 4) {
            return `Spring ${year}`;
        } else if (month >= 5 && month <= 7) {
            return `Summer ${year}`;
        } else {
            return `Fall ${year}`;
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Get days until an exam
     */
    getDaysUntilExam(exam: Exam): number {
        const now = Date.now();
        const daysUntil = Math.ceil((exam.date - now) / (24 * 60 * 60 * 1000));
        return daysUntil;
    }

    /**
     * Check if exam is in the past
     */
    isExamPast(exam: Exam): boolean {
        return exam.date < Date.now();
    }
}
