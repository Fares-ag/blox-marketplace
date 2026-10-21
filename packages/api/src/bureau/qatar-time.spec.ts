import { describe, expect, it } from 'vitest';
import { isLastCalendarDayQatar, qatarYmd, reportingPeriodOf } from './qatar-time';

describe('qatar-time', () => {
  it('uses the Qatar calendar date, not UTC', () => {
    const justAfterMidnightQatar = new Date('2026-10-01T00:30:00+03:00');
    expect(qatarYmd(justAfterMidnightQatar)).toBe('2026-10-01');
    expect(reportingPeriodOf(justAfterMidnightQatar)).toBe('2026-10');
  });

  it('detects the last calendar day in Qatar', () => {
    expect(isLastCalendarDayQatar(new Date('2026-09-30T22:00:00+03:00'))).toBe(true);
    expect(isLastCalendarDayQatar(new Date('2026-09-29T22:00:00+03:00'))).toBe(false);
    expect(isLastCalendarDayQatar(new Date('2026-02-28T22:00:00+03:00'))).toBe(true);
  });
});
