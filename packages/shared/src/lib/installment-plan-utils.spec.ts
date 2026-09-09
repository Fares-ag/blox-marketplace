import { describe, expect, it } from 'vitest';
import { generateInstallmentSchedule } from './generate-schedule';
import {
  aggregateDailyScheduleToMonthly,
  isScheduleLikelyDaily,
  normalizeInstallmentInterval,
} from './installment-plan-utils';

/** The worst case reported from the wizard: daily payments over four years. */
function dailyPlan(months: number) {
  return generateInstallmentSchedule({
    startDate: new Date('2026-10-01T00:00:00Z'),
    totalMonths: months,
    carValue: 98_000,
    downPayment: 19_600,
    annualRatePercent: 7,
    paymentInterval: 'Daily',
    reviewMode: true,
  });
}

describe('daily schedules', () => {
  it('produces a row per day, which is what made the schedule table crawl', () => {
    const schedule = dailyPlan(48);
    // Four years of daily rows; the table drew eight columns for each of them.
    expect(schedule.length).toBeGreaterThan(1_400);
    expect(isScheduleLikelyDaily(schedule)).toBe(true);
    expect(normalizeInstallmentInterval('Daily')).toBe('daily');
  });

  it('rolls up to one row per month without losing a riyal', () => {
    const schedule = dailyPlan(48);
    const monthly = aggregateDailyScheduleToMonthly(schedule);

    // Roughly two orders of magnitude fewer rows to render.
    expect(monthly.length).toBeLessThanOrEqual(50);
    expect(monthly.length).toBeGreaterThan(40);

    const dailyTotal = schedule.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const monthlyTotal = monthly.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    expect(monthlyTotal).toBeCloseTo(dailyTotal, 2);
  });

  it('leaves a monthly schedule alone', () => {
    const monthlySchedule = generateInstallmentSchedule({
      startDate: new Date('2026-10-01T00:00:00Z'),
      totalMonths: 48,
      carValue: 98_000,
      downPayment: 19_600,
      annualRatePercent: 7,
      paymentInterval: 'Monthly',
      reviewMode: true,
    });
    expect(monthlySchedule).toHaveLength(48);
    expect(isScheduleLikelyDaily(monthlySchedule)).toBe(false);
  });
});
