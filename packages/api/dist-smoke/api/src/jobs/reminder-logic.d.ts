export declare const DOCUMENT_REMINDER_THRESHOLDS: readonly number[];
export declare const TAKAFUL_REMINDER_THRESHOLDS: readonly number[];
export type ReminderKind = `d${number}` | 'expired';
export declare function reminderStages(thresholds: readonly number[]): ReminderKind[];
export declare function reminderKindFor(daysToExpiry: number, thresholds: readonly number[]): ReminderKind | null;
export declare function shouldSendReminder(kind: ReminderKind | null, lastKind: string | null | undefined, thresholds: readonly number[]): boolean;
