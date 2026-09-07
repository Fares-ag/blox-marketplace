type DecimalLike = {
    toNumber(): number;
} | number | string | null | undefined;
export type DeferralCandidate = {
    status: string;
    dueDate: Date | string;
    remainingAmount: DecimalLike;
};
export type DeferralGuardOutcome = 'ok' | 'schedule_overdue_not_deferrable' | 'schedule_not_deferrable';
export declare function utcDayStart(date: Date): number;
export declare function daysPastDue(dueDate: Date | string, now?: Date): number;
export declare function isScheduleOverdue(schedule: DeferralCandidate, now?: Date): boolean;
export declare function evaluateDeferralGuard(schedule: DeferralCandidate, now?: Date): DeferralGuardOutcome;
export declare function assertScheduleDeferrable(schedule: DeferralCandidate, now?: Date): void;
export {};
