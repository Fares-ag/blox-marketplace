import { describe, expect, it } from 'vitest';
import {
  buildInstallmentAmounts,
  buildPricingSnapshot,
  computeExactMonthlyPayment,
  financedTotal,
  paymentInputFromPricingSnapshot,
  buildPrincipalAmounts,
  sumInstallmentAmounts,
} from './pricing';

describe('pricing schedule invariants', () => {
  it('last installment absorbs rounding residual so the schedule sums to financed total', () => {
    const input = {
      price: 100_000,
      downPayment: 10_000,
      annualRatePercent: 12.5,
      tenureMonths: 36,
    };
    const amounts = buildInstallmentAmounts(input);
    expect(amounts).toHaveLength(36);
    expect(sumInstallmentAmounts(amounts)).toBe(financedTotal(input));
    expect(sumInstallmentAmounts(amounts)).toBeGreaterThan(input.price - input.downPayment);
  });

  it('principal portions sum to the loan principal', () => {
    const input = {
      price: 100_000,
      downPayment: 10_000,
      annualRatePercent: 12.5,
      tenureMonths: 36,
    };
    const principals = buildPrincipalAmounts(input);
    expect(principals).toHaveLength(36);
    expect(principals.reduce((sum, amount) => sum + amount, 0)).toBe(input.price - input.downPayment);
    expect(sumInstallmentAmounts(buildInstallmentAmounts(input))).toBeGreaterThan(
      principals.reduce((sum, amount) => sum + amount, 0),
    );
  });

  it('avoids whole-QAR rounding drift on a representative 36-month plan', () => {
    const input = {
      price: 100_000,
      downPayment: 10_000,
      annualRatePercent: 12.5,
      tenureMonths: 36,
    };
    const amounts = buildInstallmentAmounts(input);
    const legacyWholeMonthly = Math.round(computeExactMonthlyPayment(input));
    const total = sumInstallmentAmounts(amounts);
    expect(total).toBeLessThan(legacyWholeMonthly * 36);
    expect(total).toBe(financedTotal(input));
  });
});

describe('pricing contract grid', () => {
  const listPrices = [75_000, 100_000, 150_000, 225_000];
  const rates = [0, 5, 12.5, 18];
  const tenures = [12, 24, 36, 48, 60];
  const downPcts = [10, 20, 30];

  for (const listPrice of listPrices) {
    for (const rate of rates) {
      for (const tenor of tenures) {
        for (const downPct of downPcts) {
          it(`schedule sums to financed total for ${listPrice}/${rate}%/${tenor}m/${downPct}% down`, () => {
            const snapshot = buildPricingSnapshot({
              listPrice,
              annualRatePercent: rate,
              minDownPaymentPct: 10,
              tenureMonths: tenor,
              downPaymentPct: downPct,
            });
            const amounts = buildInstallmentAmounts(paymentInputFromPricingSnapshot(snapshot));
            expect(amounts).toHaveLength(tenor);
            expect(snapshot.monthly).toBe(amounts[0]);
            expect(sumInstallmentAmounts(amounts)).toBe(snapshot.financed_total);
          });
        }
      }
    }
  }
});
