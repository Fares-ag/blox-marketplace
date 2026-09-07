import { describe, expect, it } from 'vitest';
import { buildPricingSnapshot, installmentAmountsFromPricingSnapshot } from '@drivemarket/shared/pricing';
import { computeEarlySettlementQuote } from '@drivemarket/shared/domain-rules';
import {
  quoteForApplication,
  settlementRequestValues,
  settlementRowsFrom,
  settlementSavings,
  toSettlementQuoteDto,
} from './settlement-quote';

/** Prisma returns Decimal objects; the adapter must read them without `Number()` surprises. */
class FakeDecimal {
  constructor(private readonly value: number) {}
  toNumber() {
    return this.value;
  }
}

describe('settlement quote wiring', () => {
  const pricing = buildPricingSnapshot({
    listPrice: 100_000,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: 12,
    downPaymentPct: 10,
  });
  const amounts = installmentAmountsFromPricingSnapshot(pricing);
  const activatedAt = new Date('2026-01-01T00:00:00.000Z');
  const asOf = new Date('2026-05-20T00:00:00.000Z');
  // Rows 1–3 paid, row 4 overdue (due 1 May), row 5 current (due 1 June), the rest future.
  const schedules = amounts.map((amount, i) => {
    const paid = i < 3;
    return {
      sequence: i + 1,
      dueDate: new Date(Date.UTC(2026, 1 + i, 1)),
      amount: new FakeDecimal(amount),
      paidAmount: new FakeDecimal(paid ? amount : 0),
      remainingAmount: new FakeDecimal(paid ? 0 : amount),
      status: paid ? 'paid' : i === 3 ? 'overdue' : 'pending',
    };
  });
  const source = { paymentSchedules: schedules, pricingSnapshot: pricing, activatedAt };

  it('adapts Prisma rows (Decimal amounts) to the shared schedule rows', () => {
    const rows = settlementRowsFrom(schedules);
    expect(rows[0]).toEqual({
      sequence: 1,
      dueDate: schedules[0].dueDate,
      amount: amounts[0],
      paidAmount: amounts[0],
      remainingAmount: 0,
      status: 'paid',
    });
    expect(rows).toHaveLength(12);
  });

  it('quotes exactly what the shared calculator returns for the live schedule', () => {
    const quote = quoteForApplication(source, asOf);
    const expected = computeEarlySettlementQuote({
      rows: settlementRowsFrom(schedules),
      pricingSnapshot: pricing,
      asOf,
      activatedAt,
    });
    expect(quote).toEqual(expected);
    expect(quote.rows.map((row) => row.kind)).toEqual([
      'settled',
      'settled',
      'settled',
      'overdue',
      'current',
      ...Array<'future'>(7).fill('future'),
    ]);
    // Principal outstanding plus rent accrued to today; future rent forgiven.
    expect(quote.settlementAmount).toBeCloseTo(quote.principalOutstanding + quote.accruedProfit, 2);
    expect(quote.forgivenRent).toBeGreaterThan(0);
    expect(quote.savings).toBeCloseTo(quote.remainingScheduled - quote.settlementAmount, 2);
    expect(quote.overdueAmount).toBeCloseTo(amounts[3], 2);
    expect(quote.settlementAmount).toBeLessThan(quote.remainingScheduled);
  });

  it('tolerates a missing pricing snapshot and activation date', () => {
    const quote = quoteForApplication({ paymentSchedules: schedules, pricingSnapshot: null }, asOf);
    expect(quote.remainingScheduled).toBeCloseTo(
      amounts.slice(3).reduce((sum, a) => sum + a, 0),
      2,
    );
    expect(quote.settlementAmount).toBeGreaterThan(0);
  });

  it('maps the quote to SettlementQuoteDto field for field', () => {
    const quote = quoteForApplication(source, asOf);
    const dto = toSettlementQuoteDto(quote);
    expect(Object.keys(dto).sort()).toEqual(
      [
        'as_of',
        'principal_outstanding',
        'accrued_profit',
        'overdue_amount',
        'forgiven_rent',
        'settlement_amount',
        'remaining_scheduled',
        'savings',
        'rows',
      ].sort(),
    );
    expect(dto.as_of).toBe(asOf.toISOString());
    expect(dto.settlement_amount).toBe(quote.settlementAmount);
    expect(dto.rows).toHaveLength(12);
    expect(Object.keys(dto.rows[0]).sort()).toEqual(
      ['sequence', 'due_date', 'kind', 'principal_outstanding', 'rent_outstanding', 'accrued_rent', 'forgiven_rent'].sort(),
    );
    expect(dto.rows[3]).toMatchObject({ sequence: 4, due_date: '2026-05-01', kind: 'overdue' });
  });

  it('turns the quote into the settlement request columns', () => {
    const quote = quoteForApplication(source, asOf);
    expect(settlementRequestValues(quote)).toEqual({
      settlementAmount: quote.settlementAmount,
      remainingPrincipal: quote.principalOutstanding,
      forgivenRent: quote.forgivenRent,
      accruedProfit: quote.accruedProfit,
      quoteAsOf: asOf,
    });
  });

  it('reports savings as forgiven rent plus any ops discount', () => {
    expect(settlementSavings({ forgivenRent: new FakeDecimal(1_234.5), discountAmount: new FakeDecimal(100) })).toBe(1_334.5);
    expect(settlementSavings({ forgivenRent: '80.25' })).toBe(80.25);
    expect(settlementSavings({ forgivenRent: null })).toBe(0);
  });
});
