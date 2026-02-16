export function subtractMinutes(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    date.setMinutes(date.getMinutes() - minutes);

    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function getCurrentTime(): string {
    const date = new Date();
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function getMillisUntil(time: string): number {
    const [hours, mins] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, mins, 0, 0);

    let millis = target.getTime() - now.getTime();
    if (millis < 0) {
        // If time has passed today, target is tomorrow
        target.setDate(target.getDate() + 1);
        millis = target.getTime() - now.getTime();
    }
    return millis;
}
