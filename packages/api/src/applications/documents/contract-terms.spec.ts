import { describe, expect, it } from 'vitest';
import { buildPlanFromPricingSnapshot } from '@drivemarket/shared/installment-plan';
import { resolveContractTerms } from './contract-terms';

describe('resolveContractTerms', () => {
  it('reconciles down payment amount with down payment percentage', () => {
    const approvedAt = new Date('2026-09-12T12:00:00.000Z');
    const terms = resolveContractTerms(
      {
        list_price: 300_000,
        down_payment: 20_000,
        down_payment_pct: 20,
        rate: 11.9,
        tenor: 36,
      },
      approvedAt,
    );

    expect(terms.downPayment).toBe(60_000);
    expect(terms.downPaymentPct).toBe(20);
    expect(terms.monthly).toBeGreaterThan(0);
    expect(terms.schedule).toHaveLength(36);
    expect(terms.schedule[0]?.payment).toBe(terms.monthly);
  });

  it('derives total rent from the schedule', () => {
    const approvedAt = new Date('2026-09-12T12:00:00.000Z');
    const terms = resolveContractTerms(
      {
        list_price: 300_000,
        down_payment: 60_000,
        down_payment_pct: 20,
        rate: 11.9,
        tenor: 36,
      },
      approvedAt,
    );
    const totalRent = terms.schedule.reduce((sum, row) => sum + row.interest, 0);
    expect(totalRent).toBeGreaterThan(0);
    expect(terms.financedTotal).toBeGreaterThan(terms.listPrice - terms.downPayment);
  });

  it('uses balloon installment plan for in-house conventional contracts', () => {
    const approvedAt = new Date('2026-02-01T10:00:00.000Z');
    const pricing = {
      list_price: 120_000,
      down_payment: 24_000,
      down_payment_pct: 20,
      rate: 11.9,
      tenor: 48,
      calculation_method: 'balloon_payment',
      balloon_pct: 30,
      installment_pct: 50,
      first_installment_date: '2026-03-01',
    };
    const plan = buildPlanFromPricingSnapshot({ pricingSnapshot: pricing, asOf: approvedAt });
    const terms = resolveContractTerms(pricing, approvedAt, plan);

    expect(terms.tenor).toBe(48);
    expect(terms.schedule).toHaveLength(49);
    expect(terms.balloonAmount).toBe(36_000);
    expect(terms.monthly).toBe(plan.schedule.find((r) => r.paymentType === 'installment')?.amount);
    const last = terms.schedule[terms.schedule.length - 1];
    expect(last?.principal).toBe(36_000);
    expect(terms.financedTotal).toBeCloseTo(
      terms.schedule.reduce((sum, row) => sum + row.payment, 0),
      0,
    );
  });
});
