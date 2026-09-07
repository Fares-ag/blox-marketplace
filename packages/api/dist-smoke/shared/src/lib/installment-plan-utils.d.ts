import type { PaymentScheduleRow } from '../types/installment-plan';
export type NormalizedInstallmentInterval = 'daily' | 'monthly' | 'other';
export declare function normalizeInstallmentInterval(interval?: string): NormalizedInstallmentInterval;
export declare function isScheduleLikelyDaily(schedule: PaymentScheduleRow[]): boolean;
export declare function aggregateDailyScheduleToMonthly(schedule: PaymentScheduleRow[]): PaymentScheduleRow[];
