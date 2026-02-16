import { App, Modal, Setting } from 'obsidian';

export class GoalModal extends Modal {
    result: { title: string; description: string };
    onSubmit: (result: { title: string; description: string }) => void;
    initialData?: { title: string; description: string };

    constructor(app: App, onSubmit: (result: { title: string; description: string }) => void, initialData?: { title: string; description: string }) {
        super(app);
        this.onSubmit = onSubmit;
        this.initialData = initialData;
        this.result = initialData ? { ...initialData } : { title: '', description: '' };
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h1', { text: this.initialData ? 'Edit Goal' : 'Create New Goal' });

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setValue(this.result.title)
                .onChange(value => {
                    this.result.title = value;
                }));

        new Setting(contentEl)
            .setName('Description')
            .addTextArea(text => text
                .setValue(this.result.description)
                .onChange(value => {
                    this.result.description = value;
                }));
        // Type dropdown removed

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Create')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.result);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
