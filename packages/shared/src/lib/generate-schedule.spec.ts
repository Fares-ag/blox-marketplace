import { describe, expect, it } from 'vitest';
import { addMonths, firstInstallmentDueFrom, formatDateYmd, startOfMonth } from './date-utils';
import { generateInstallmentSchedule, buildPlanFromPricingSnapshot } from './generate-schedule';
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

describe('buildPlanFromPricingSnapshot dates', () => {
  it('starts the plan from asOf (submit), not the current clock', () => {
    const snap = {
      tenor: 3,
      list_price: 100_000,
      down_payment: 10_000,
      rate: 0,
      monthly: 30_000,
    };
    const asOf = new Date('2026-04-18T12:00:00.000Z');
    const first = firstInstallmentDueFrom(asOf);
    const plan = buildPlanFromPricingSnapshot({
      pricingSnapshot: snap,
      asOf,
    });
    expect(plan.schedule[0]?.dueDate).toBe(formatDateYmd(first));
    expect(plan.schedule[2]?.dueDate).toBe(formatDateYmd(addMonths(first, 2)));
  });

  it('honors first_installment_date on the pricing snapshot', () => {
    const plan = buildPlanFromPricingSnapshot({
      pricingSnapshot: {
        tenor: 3,
        list_price: 100_000,
        down_payment: 10_000,
        rate: 10.5,
        first_installment_date: '2026-08-01',
      },
    });
    expect(plan.schedule[0]?.dueDate).toBe('2026-08-01');
    expect(plan.annualRentalRate).toBe(0.105);
  });

  it('rebuilds an in-house balloon plan from the pricing snapshot', () => {
    const plan = buildPlanFromPricingSnapshot({
      pricingSnapshot: {
        tenor: 48,
        list_price: 120_000,
        down_payment: 24_000,
        down_payment_pct: 20,
        rate: 11.9,
        calculation_method: 'balloon_payment',
        balloon_pct: 30,
        first_installment_date: '2026-02-01',
      },
    });
    expect(plan.calculationMethod).toBe('balloon_payment');
    expect(plan.paymentStructure?.balloonPercent).toBe(30);
    expect(plan.schedule.filter((row) => row.isBalloon)).toHaveLength(1);
    expect(plan.schedule.filter((row) => row.paymentType === 'installment')).toHaveLength(48);
  });
});
