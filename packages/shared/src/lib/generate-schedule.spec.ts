import { describe, expect, it } from 'vitest';
import { addMonths, startOfMonth } from './date-utils';
import { generateInstallmentSchedule } from './generate-schedule';
import { sumInstallmentAmounts } from './pricing';

describe('generateInstallmentSchedule (amortized_fixed)', () => {
  const startDate = addMonths(startOfMonth(new Date('2026-01-15')), 1);

  it('produces 12 equal payments of 7,500 at 0% for 100k / 10% down / 12m', () => {
    const schedule = generateInstallmentSchedule({
      startDate,
      totalMonths: 12,
      carValue: 100_000,
      downPayment: 10_000,
      annualRatePercent: 0,
      reviewMode: true,
    });
    expect(schedule).toHaveLength(12);
    for (const row of schedule) {
      expect(row.amount).toBe(7_500);
    }
  });

  it('produces 7 payments summing to financed total for 7-month tenure at 0%', () => {
    const schedule = generateInstallmentSchedule({
      startDate,
      totalMonths: 7,
      carValue: 100_000,
      downPayment: 10_000,
      annualRatePercent: 0,
      reviewMode: true,
    });
    expect(schedule).toHaveLength(7);
    expect(sumInstallmentAmounts(schedule.map((r) => r.amount))).toBe(90_000);
  });

  it('last payment absorbs rounding at >0% rate', () => {
    const schedule = generateInstallmentSchedule({
      startDate,
      totalMonths: 36,
      carValue: 100_000,
      downPayment: 10_000,
      annualRatePercent: 12.5,
      reviewMode: true,
    });
    expect(schedule).toHaveLength(36);
    const first = schedule[0]!.amount;
    for (let i = 0; i < 35; i += 1) {
      expect(schedule[i]!.amount).toBe(first);
    }
    const total = sumInstallmentAmounts(schedule.map((r) => r.amount));
    expect(total).toBeGreaterThan(90_000);
  });

  it('daily interval preserves monthly totals', () => {
    const monthly = generateInstallmentSchedule({
      startDate,
      totalMonths: 3,
      carValue: 100_000,
      downPayment: 10_000,
      annualRatePercent: 0,
      paymentInterval: 'Monthly',
      reviewMode: true,
    });
    const daily = generateInstallmentSchedule({
      startDate,
      totalMonths: 3,
      carValue: 100_000,
      downPayment: 10_000,
      annualRatePercent: 0,
      paymentInterval: 'Daily',
      reviewMode: true,
    });
    const monthlyTotal = sumInstallmentAmounts(monthly.map((r) => r.amount));
    const dailyTotal = sumInstallmentAmounts(daily.map((r) => r.amount));
    expect(dailyTotal).toBe(monthlyTotal);
  });
});
