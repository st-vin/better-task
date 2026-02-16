import { App, Modal, Setting, Notice } from 'obsidian';
import { StudentUnit } from '../types';

export class UnitModal extends Modal {
    private onSubmit: (unitData: Partial<StudentUnit>, shouldClose: boolean) => void;
    private unitData: Partial<StudentUnit> = {};

    constructor(app: App, onSubmit: (unitData: Partial<StudentUnit>, shouldClose: boolean) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        this.renderContent();
    }

    renderContent() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Create New Unit' });

        // Unit Name
        new Setting(contentEl)
            .setName('Unit Name')
            .setDesc('Full name of the unit/course')
            .addText(text => text
                .setPlaceholder('e.g., Introduction to Computer Science')
                .setValue(this.unitData.name || '')
                .onChange(value => {
                    this.unitData.name = value;
                }));

        // Unit Code
        new Setting(contentEl)
            .setName('Unit Code')
            .setDesc('Course code or number')
            .addText(text => text
                .setPlaceholder('e.g., CS101')
                .setValue(this.unitData.code || '')
                .onChange(value => {
                    this.unitData.code = value;
                }));

        // Semester
        new Setting(contentEl)
            .setName('Semester')
            .setDesc('When this unit is taught')
            .addText(text => text
                .setPlaceholder('e.g., Fall 2026')
                .setValue(this.unitData.semester || '')
                .onChange(value => {
                    this.unitData.semester = value;
                }));

        // Credits
        new Setting(contentEl)
            .setName('Credits')
            .setDesc('Number of credit hours')
            .addText(text => text
                .setPlaceholder('e.g., 3')
                .setValue(this.unitData.credits?.toString() || '')
                .onChange(value => {
                    const credits = parseInt(value);
                    this.unitData.credits = isNaN(credits) ? 0 : credits;
                }));

        // Instructor (optional)
        new Setting(contentEl)
            .setName('Instructor')
            .setDesc('Professor or teacher name (optional)')
            .addText(text => text
                .setPlaceholder('e.g., Dr. Smith')
                .setValue(this.unitData.instructor || '')
                .onChange(value => {
                    this.unitData.instructor = value || undefined;
                }));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container', attr: { style: 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;' } });

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        const addAnotherBtn = buttonContainer.createEl('button', {
            text: 'Create & Add Another'
        });
        addAnotherBtn.addEventListener('click', () => {
            if (this.validateForm()) {
                this.onSubmit(this.unitData, false);
                // Reset data but keep semester maybe? No, clear all for now to be safe, or maybe keep semester.
                // Let's clear name and code, keep semester if possible?
                // For simplicity, let's clear main fields.
                const currentSemester = this.unitData.semester;
                this.unitData = { semester: currentSemester };
                this.renderContent(); // Re-render to clear fields
                // Focus on first field? Hard with Obsidian API, but re-render works.
            }
        });

        const submitBtn = buttonContainer.createEl('button', {
            text: 'Create Unit',
            cls: 'mod-cta'
        });
        submitBtn.addEventListener('click', () => {
            if (this.validateForm()) {
                this.onSubmit(this.unitData, true);
                this.close();
            }
        });
    }

    validateForm(): boolean {
        if (!this.unitData.name || !this.unitData.code) {
            new Notice('Please fill in unit name and code'); // Use Notice instead of alert
            return false;
        }
        return true;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
