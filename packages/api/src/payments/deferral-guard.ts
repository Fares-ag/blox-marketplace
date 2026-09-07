import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * Deferral eligibility for one installment (Blox membership benefit).
 *
 * An installment that is already overdue — `status` overdue, or its due date
 * has passed with money still owed — cannot be pushed out: the deferral is a
 * planning tool, not a cure for arrears (409 `schedule_overdue_not_deferrable`).
 * A row due *today* is still deferrable. Paid or waived rows are simply not
 * deferrable (400 `schedule_not_deferrable`).
 *
 * Pure so the guard is unit-tested without a database.
 */

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export type DeferralCandidate = {
  status: string;
  dueDate: Date | string;
  remainingAmount: DecimalLike;
};

export type DeferralGuardOutcome = 'ok' | 'schedule_overdue_not_deferrable' | 'schedule_not_deferrable';

const DAY_MS = 86_400_000;

function asNumber(value: DecimalLike): number {
  if (value == null) return 0;
  const n = typeof value === 'object' ? value.toNumber() : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days the due date is in the past (negative when still ahead). */
export function daysPastDue(dueDate: Date | string, now: Date = new Date()): number {
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return Math.round((utcDayStart(now) - utcDayStart(due)) / DAY_MS);
}

export function isScheduleOverdue(schedule: DeferralCandidate, now: Date = new Date()): boolean {
  if (schedule.status === 'overdue') return true;
  return daysPastDue(schedule.dueDate, now) > 0 && asNumber(schedule.remainingAmount) > 0;
}

export function evaluateDeferralGuard(schedule: DeferralCandidate, now: Date = new Date()): DeferralGuardOutcome {
  if (isScheduleOverdue(schedule, now)) return 'schedule_overdue_not_deferrable';
  if (schedule.status !== 'pending') return 'schedule_not_deferrable';
  return 'ok';
}

export function assertScheduleDeferrable(schedule: DeferralCandidate, now: Date = new Date()): void {
  const outcome = evaluateDeferralGuard(schedule, now);
  if (outcome === 'ok') return;
  if (outcome === 'schedule_overdue_not_deferrable') {
    throw new ConflictException({
      message: outcome,
      days_past_due: Math.max(0, daysPastDue(schedule.dueDate, now)),
    });
  }
  throw new BadRequestException(outcome);
}
