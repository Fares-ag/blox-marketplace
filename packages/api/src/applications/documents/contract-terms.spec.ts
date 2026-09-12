import { describe, expect, it } from 'vitest';
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
});
