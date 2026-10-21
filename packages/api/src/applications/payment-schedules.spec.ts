import { describe, expect, it } from 'vitest';
import { buildPricingSnapshot, sumInstallmentAmounts } from '@drivemarket/shared/pricing';
import { buildScheduleDrafts } from './payment-schedules';

describe('buildScheduleDrafts', () => {
  it('creates N monthly schedules from pricing snapshot with last-installment true-up', () => {
    const start = new Date('2026-01-15T12:00:00.000Z');
    const snapshot = buildPricingSnapshot({
      listPrice: 100_000,
      annualRatePercent: 12.5,
      minDownPaymentPct: 10,
      tenureMonths: 36,
      downPaymentPct: 10,
    });
    const drafts = buildScheduleDrafts(snapshot, start);
    expect(drafts).toHaveLength(36);
    expect(drafts[0].sequence).toBe(1);
    expect(drafts[0].amount).toBe(snapshot.monthly);
    expect(drafts[35].sequence).toBe(36);
    expect(sumInstallmentAmounts(drafts.map((d) => d.amount))).toBe(snapshot.financed_total);
  });

  it('throws on invalid pricing', () => {
    expect(() => buildScheduleDrafts({ monthly: 0, tenor: 12 })).toThrow('invalid_pricing_snapshot');
  });

  it('honours an explicit first installment date on the pricing snapshot', () => {
    const snapshot = {
      ...buildPricingSnapshot({
        listPrice: 100_000,
        annualRatePercent: 12.5,
        minDownPaymentPct: 10,
        tenureMonths: 12,
        downPaymentPct: 10,
      }),
      first_installment_date: '2026-11-05',
    };
    const drafts = buildScheduleDrafts(snapshot, new Date('2026-01-15T12:00:00.000Z'));
    expect(drafts[0].dueDate.toISOString().slice(0, 10)).toBe('2026-11-05');
    expect(drafts[1].dueDate.toISOString().slice(0, 10)).toBe('2026-12-05');
  });
});
