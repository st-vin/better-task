import { App, Modal, Setting, Notice } from 'obsidian';
import { Exam, StudentUnit } from '../types';

export class ExamModal extends Modal {
    private onSubmit: (examData: Partial<Exam>) => void;
    private examData: Partial<Exam> = {};
    private unit: StudentUnit;

    constructor(app: App, unit: StudentUnit, onSubmit: (examData: Partial<Exam>) => void) {
        super(app);
        this.unit = unit;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: `Add exam for ${this.unit.name}` });

        // Exam Title
        new Setting(contentEl)
            .setName('Exam Title')
            .setDesc('Name or type of the exam')
            .addText(text => text
                .setPlaceholder('e.g., Midterm Exam, Final Exam')
                .onChange(value => {
                    this.examData.title = value;
                }));

        // Date
        new Setting(contentEl)
            .setName('Date')
            .setDesc('Exam date')
            .addText(text => {
                text.inputEl.type = 'date';
                text.setPlaceholder('YYYY-MM-DD')
                    .onChange(value => {
                        // Handle date input value (YYYY-MM-DD)
                        if (value) {
                            const parts = value.split('-');
                            // Create date in local time 00:00:00
                            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                            this.examData.date = dateObj.getTime();
                        }
                    });
            });

        // Time
        new Setting(contentEl)
            .setName('Time')
            .setDesc('Exam time (24-hour format)')
            .addText(text => {
                text.inputEl.type = 'time';
                text.setPlaceholder('HH:MM')
                    .setValue('09:00')
                    .onChange(value => {
                        this.examData.time = value;
                    });
            });

        // Location (optional)
        new Setting(contentEl)
            .setName('Location')
            .setDesc('Exam room or building (optional)')
            .addText(text => text
                .setPlaceholder('e.g., Room 301, Building A')
                .onChange(value => {
                    this.examData.location = value || undefined;
                }));

        // Topics
        new Setting(contentEl)
            .setName('Topics')
            .setDesc('Comma-separated list of exam topics')
            .addTextArea(textArea => {
                textArea
                    .setPlaceholder('e.g., Data Structures, Algorithms, Complexity Analysis')
                    .onChange(value => {
                        // Split by comma and trim whitespace
                        this.examData.topics = value
                            .split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0);
                    });
                textArea.inputEl.rows = 4;
                textArea.inputEl.addClass('textarea-full-width');
            });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const submitBtn = buttonContainer.createEl('button', {
            text: 'Add exam',
            cls: 'mod-cta'
        });

        const addAnotherBtn = buttonContainer.createEl('button', {
            text: 'Add & another',
            attr: { style: 'margin-right: 10px;' }
        });

        const handleSubmit = (shouldClose: boolean) => {
            if (!this.examData.title || !this.examData.date) {
                new Notice('Please fill in exam title and date');
                return;
            }
            if (!this.examData.time) {
                this.examData.time = '09:00';
            }
            if (!this.examData.topics || this.examData.topics.length === 0) {
                this.examData.topics = ['General Review'];
            }
            this.onSubmit(this.examData);

            if (shouldClose) {
                this.close();
            } else {
                new Notice('Exam added! Add another.');
                // Reset fields
                this.examData.title = '';
                this.examData.topics = [];
                // Keep date/time as exams might be close
                this.onOpen(); // Re-render
            }
        };

        addAnotherBtn.addEventListener('click', () => handleSubmit(false));
        submitBtn.addEventListener('click', () => handleSubmit(true));

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
