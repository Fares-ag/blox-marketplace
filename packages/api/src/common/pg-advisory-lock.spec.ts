import { describe, expect, it } from 'vitest';
import { cronJobLockKey } from './pg-advisory-lock';

describe('cronJobLockKey', () => {
  it('returns a stable bigint for the same job name', () => {
    expect(cronJobLockKey('payment-reminders')).toBe(cronJobLockKey('payment-reminders'));
    expect(cronJobLockKey('payment-reminders')).not.toBe(cronJobLockKey('overdue-sweep'));
  });
});
