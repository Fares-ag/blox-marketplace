import { describe, expect, it } from 'vitest';
import { buildPricingSnapshot, principalAmountsFromPricingSnapshot, installmentAmountsFromPricingSnapshot } from './pricing';
import { computeEarlySettlementQuote } from './settlement';

function plan(paidCount: number) {
  const snapshot = buildPricingSnapshot({
    listPrice: 60_000,
    annualRatePercent: 12,
    minDownPaymentPct: 20,
    tenureMonths: 12,
    downPaymentPct: 20,
  }) as unknown as Record<string, unknown>;
  const amounts = installmentAmountsFromPricingSnapshot(snapshot);
  const rows = amounts.map((amount, i) => ({
    sequence: i + 1,
    dueDate: new Date(Date.UTC(2026, i, 15)),
    amount,
    paidAmount: i < paidCount ? amount : 0,
    remainingAmount: i < paidCount ? 0 : amount,
    status: i < paidCount ? 'paid' : 'pending',
  }));
  return { snapshot, rows, amounts };
}

describe('early settlement quote', () => {
  it('charges principal outstanding plus rent accrued to date, forgiving future rent', () => {
    const { snapshot, rows } = plan(4);
    const asOf = new Date(Date.UTC(2026, 4, 1)); // 1 May: between installments 4 (15 Apr) and 5 (15 May)
    const quote = computeEarlySettlementQuote({ rows, pricingSnapshot: snapshot, asOf });
    const principals = principalAmountsFromPricingSnapshot(snapshot);
    const expectedPrincipal = principals.slice(4).reduce((a, b) => a + b, 0);

    expect(quote.principalOutstanding).toBeCloseTo(expectedPrincipal, 0);
    expect(quote.accruedProfit).toBeGreaterThan(0);
    expect(quote.settlementAmount).toBeLessThan(quote.remainingScheduled);
    expect(quote.settlementAmount).toBeCloseTo(quote.principalOutstanding + quote.accruedProfit, 2);
    expect(quote.forgivenRent + quote.accruedProfit + quote.principalOutstanding).toBeCloseTo(quote.remainingScheduled, 0);
    expect(quote.rows[4].kind).toBe('current');
    expect(quote.rows[5].kind).toBe('future');
    expect(quote.rows[3].kind).toBe('settled');
    expect(quote.savings).toBeCloseTo(quote.forgivenRent, 0);
  });

  it('includes overdue installments in full', () => {
    const { snapshot, rows } = plan(2);
    const asOf = new Date(Date.UTC(2026, 3, 20)); // installments 3 and 4 overdue, 5 current
    const quote = computeEarlySettlementQuote({ rows, pricingSnapshot: snapshot, asOf });
    expect(quote.rows[2].kind).toBe('overdue');
    expect(quote.rows[3].kind).toBe('overdue');
    expect(quote.overdueAmount).toBeCloseTo(rows[2].amount + rows[3].amount, 2);
    expect(quote.rows[2].forgivenRent).toBe(0);
  });

  it('never exceeds the scheduled remainder and handles a fully paid plan', () => {
    const { snapshot, rows } = plan(12);
    const quote = computeEarlySettlementQuote({ rows, pricingSnapshot: snapshot, asOf: new Date(Date.UTC(2027, 0, 1)) });
    expect(quote.settlementAmount).toBe(0);
    expect(quote.remainingScheduled).toBe(0);
  });

  it('falls back to proportional principal when the schedule no longer matches the snapshot', () => {
    const { snapshot, rows } = plan(0);
    const rescheduled = rows.slice(0, 6).map((r) => ({ ...r, amount: r.amount * 2, remainingAmount: r.amount * 2 }));
    const quote = computeEarlySettlementQuote({ rows: rescheduled, pricingSnapshot: snapshot, asOf: new Date(Date.UTC(2025, 11, 1)) });
    expect(quote.principalOutstanding).toBeCloseTo(48_000, 0);
    expect(quote.accruedProfit).toBe(0);
  });
});
