import { describe, expect, it } from 'vitest';
import {
  buildBalloonInstallmentPlan,
  calculateBalloonPaymentSchedule,
  clampBalloonPercent,
  isValidBalloonStructure,
  resolveBalloonStructure,
  validatePaymentStructure,
} from './balloon-payment';
import { parseYmd } from './date-utils';

describe('balloon payment structure', () => {
  it('accepts a 20 / 50 / 30 split', () => {
    const structure = resolveBalloonStructure(20, 30);
    expect(structure).toEqual({
      downPaymentPercent: 20,
      installmentPercent: 50,
      balloonPercent: 30,
    });
    expect(validatePaymentStructure(20, 50, 30).isValid).toBe(true);
    expect(isValidBalloonStructure(structure)).toBe(true);
  });

  it('rejects a split that does not sum to 100 or has a zero balloon', () => {
    expect(isValidBalloonStructure(resolveBalloonStructure(20, 0))).toBe(false);
    expect(isValidBalloonStructure({ downPaymentPercent: 20, installmentPercent: 80, balloonPercent: 0 })).toBe(false);
    expect(validatePaymentStructure(20, 40, 30).isValid).toBe(false);
  });

  it('clamps balloon so at least 1% stays for monthly principal', () => {
    expect(clampBalloonPercent(20, 30)).toBe(30);
    expect(clampBalloonPercent(20, 90)).toBe(79);
    expect(clampBalloonPercent(90, 30)).toBe(9);
    expect(clampBalloonPercent(99, 30)).toBe(0);
  });
});

describe('calculateBalloonPaymentSchedule 20/50/30', () => {
  const startDate = parseYmd('2026-01-01');

  it('puts 20% down, 48 monthly rows on 50%, and a balloon after the last installment', () => {
    const calc = calculateBalloonPaymentSchedule({
      vehiclePrice: 120_000,
      downPayment: 0,
      downPaymentPercent: 20,
      installmentPercent: 50,
      balloonPercent: 30,
      termMonths: 48,
      annualRentalRate: 0.119,
      startDate,
      interval: 'Monthly',
    });

    expect(calc.downPaymentAmount).toBe(24_000);
    expect(calc.balloonAmount).toBe(36_000);
    expect(calc.totalInstallmentAmount).toBe(60_000);
    expect(calc.principalPerMonth).toBe(1_250);

    const downs = calc.schedule.filter((row) => row.paymentType === 'down_payment');
    const installments = calc.schedule.filter((row) => row.paymentType === 'installment');
    const balloons = calc.schedule.filter((row) => row.isBalloon);

    expect(downs).toHaveLength(1);
    expect(downs[0]?.amount).toBe(24_000);
    expect(installments).toHaveLength(48);
    expect(balloons).toHaveLength(1);
    expect(balloons[0]?.amount).toBeGreaterThan(36_000);
    expect(balloons[0]?.dueDate && installments[47]?.dueDate).toBeTruthy();
    expect(String(balloons[0]?.dueDate) > String(installments[47]?.dueDate)).toBe(true);
  });

  it('builds an installment plan the dealer wizard can persist', () => {
    const plan = buildBalloonInstallmentPlan({
      vehiclePrice: 120_000,
      downPaymentPercent: 20,
      balloonPercent: 30,
      termMonths: 48,
      annualRatePercent: 11.9,
      startDate,
    });
    expect(plan.calculationMethod).toBe('balloon_payment');
    expect(plan.paymentStructure).toEqual({
      downPaymentPercent: 20,
      installmentPercent: 50,
      balloonPercent: 30,
    });
    expect(plan.downPayment).toBe(24_000);
    expect(plan.balloonPayment?.amount).toBe(36_000);
    expect(plan.schedule.filter((row) => row.paymentType === 'installment')).toHaveLength(48);
    expect(plan.monthlyAmount).toBeGreaterThan(1_250);
  });
});
