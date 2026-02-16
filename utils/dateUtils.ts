export function getDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
}
