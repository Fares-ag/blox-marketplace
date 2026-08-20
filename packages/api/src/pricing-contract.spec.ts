import { describe, expect, it } from 'vitest';
import {
  buildPricingSnapshot as sharedBuildPricingSnapshot,
  sumInstallmentAmounts,
  paymentInputFromPricingSnapshot,
  buildInstallmentAmounts,
} from '@drivemarket/shared/pricing';
import { buildApplicationPricingSnapshot } from './applications/application-pricing';
import { buildScheduleDrafts } from './applications/payment-schedules';
import { buildPricingSnapshot as apiBuildPricingSnapshot } from './quotes/quote-pricing';

describe('pricing contract (shared vs API)', () => {
  const grid = [
    { listPrice: 100_000, rate: 12.5, tenor: 36, downPct: 10 },
    { listPrice: 150_000, rate: 5, tenor: 48, downPct: 20 },
    { listPrice: 89_500, rate: 0, tenor: 24, downPct: 15 },
    { listPrice: 220_000, rate: 18, tenor: 60, downPct: 25 },
  ] as const;

  for (const sample of grid) {
    it(`shared and API pricing agree for ${sample.listPrice}/${sample.rate}%/${sample.tenor}m`, () => {
      const input = {
        listPrice: sample.listPrice,
        annualRatePercent: sample.rate,
        minDownPaymentPct: 10,
        tenureMonths: sample.tenor,
        downPaymentPct: sample.downPct,
      };

      const shared = sharedBuildPricingSnapshot(input);
      const api = apiBuildPricingSnapshot(input);
      expect(api).toEqual(shared);

      const serverSnap = buildApplicationPricingSnapshot({
        listPrice: sample.listPrice,
        offer: {
          annualRentRate: sample.rate,
          minDownPaymentPct: 10,
          tenureOptions: [12, 24, 36, 48, 60],
        },
        pricingSnapshot: { tenor: sample.tenor, down_payment_pct: sample.downPct },
      });
      expect(serverSnap).toEqual(shared);

      const drafts = buildScheduleDrafts(serverSnap);
      expect(drafts).toHaveLength(sample.tenor);
      const scheduleSum = sumInstallmentAmounts(drafts.map((d) => d.amount));
      expect(scheduleSum).toBe(shared.financed_total);

      const amounts = buildInstallmentAmounts(paymentInputFromPricingSnapshot(shared));
      expect(sumInstallmentAmounts(amounts)).toBe(shared.financed_total);
    });
  }
});
