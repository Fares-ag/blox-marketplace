import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertScheduleDeferrable,
  daysPastDue,
  evaluateDeferralGuard,
  isScheduleOverdue,
} from './deferral-guard';

const NOW = new Date('2026-09-07T15:30:00.000Z');

describe('deferral guard', () => {
  it('counts whole days past due at day granularity', () => {
    expect(daysPastDue(new Date('2026-09-07T00:00:00.000Z'), NOW)).toBe(0);
    expect(daysPastDue(new Date('2026-09-06T00:00:00.000Z'), NOW)).toBe(1);
    expect(daysPastDue('2026-10-01', NOW)).toBe(-24);
  });

  it('treats status overdue as overdue whatever the date', () => {
    expect(isScheduleOverdue({ status: 'overdue', dueDate: '2026-12-01', remainingAmount: 2_500 }, NOW)).toBe(true);
    expect(evaluateDeferralGuard({ status: 'overdue', dueDate: '2026-12-01', remainingAmount: 2_500 }, NOW)).toBe(
      'schedule_overdue_not_deferrable',
    );
  });

  it('treats a pending row whose due date has passed with money owed as overdue', () => {
    const late = { status: 'pending', dueDate: '2026-09-01', remainingAmount: 1_000 };
    expect(isScheduleOverdue(late, NOW)).toBe(true);
    expect(evaluateDeferralGuard(late, NOW)).toBe('schedule_overdue_not_deferrable');
  });

  it('keeps a row due today deferrable (the seeded fixture case)', () => {
    const today = { status: 'pending', dueDate: new Date('2026-09-07T00:00:00.000Z'), remainingAmount: 1_000 };
    expect(isScheduleOverdue(today, NOW)).toBe(false);
    expect(evaluateDeferralGuard(today, NOW)).toBe('ok');
  });

  it('keeps a future pending row deferrable', () => {
    expect(evaluateDeferralGuard({ status: 'pending', dueDate: '2026-10-01', remainingAmount: 1_000 }, NOW)).toBe('ok');
  });

  it('refuses paid and waived rows as not deferrable', () => {
    expect(evaluateDeferralGuard({ status: 'paid', dueDate: '2026-10-01', remainingAmount: 0 }, NOW)).toBe(
      'schedule_not_deferrable',
    );
    expect(evaluateDeferralGuard({ status: 'waived', dueDate: '2026-10-01', remainingAmount: 0 }, NOW)).toBe(
      'schedule_not_deferrable',
    );
  });

  it('throws 409 schedule_overdue_not_deferrable with the days past due', () => {
    try {
      assertScheduleDeferrable({ status: 'pending', dueDate: '2026-09-01', remainingAmount: 1_000 }, NOW);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
      expect((error as ConflictException).getResponse()).toEqual({
        message: 'schedule_overdue_not_deferrable',
        days_past_due: 6,
      });
    }
  });

  it('throws 400 schedule_not_deferrable for settled rows and passes otherwise', () => {
    expect(() => assertScheduleDeferrable({ status: 'paid', dueDate: '2026-10-01', remainingAmount: 0 }, NOW)).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertScheduleDeferrable({ status: 'pending', dueDate: '2026-10-01', remainingAmount: 1_000 }, NOW),
    ).not.toThrow();
  });
});
