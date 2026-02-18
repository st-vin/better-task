import { App, Modal } from 'obsidian';

export class WelcomeModal extends Modal {
    onCloseCallback: () => void;

    constructor(app: App, onCloseCallback: () => void) {
        super(app);
        this.onCloseCallback = onCloseCallback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('better-task-welcome-modal');

        contentEl.createEl('h1', { text: 'Welcome to Better Task! 🚀' });

        const introText = contentEl.createEl('div', { cls: 'welcome-content' });
        introText.createEl('p', { text: 'Your new productivity companion for Obsidian.' });

        introText.createEl('h3', { text: 'How it works' });
        const steps = introText.createEl('ul');
        steps.createEl('li', { text: '🎯 Create goals to define what you want to achieve.' });
        steps.createEl('li', { text: '📅 Add daily tasks linked to your goals.' });
        steps.createEl('li', { text: '🔥 Build streaks and track your progress.' });

        const note = introText.createEl('p', { cls: 'student-note' });
        note.createEl('strong', { text: '🎓 Student?' });
        note.createSpan({ text: ' Student mode is enabled by default. You can manage your courses and exams right away.' });

        const btnContainer = contentEl.createEl('div', { cls: 'welcome-actions' });
        const btn = btnContainer.createEl('button', { cls: 'mod-cta', text: 'Let\'s get started' });

        btn.onclick = () => {
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onCloseCallback();
    }
}
