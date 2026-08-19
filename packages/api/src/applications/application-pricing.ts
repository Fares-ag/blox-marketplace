import type { Offer, Product } from '@prisma/client';
import {
  assertTenureAllowed,
  buildPricingSnapshot,
  clampDownPaymentPct,
} from '../quotes/quote-pricing';

export function resolveTenureMonths(pricingSnapshot: Record<string, unknown>, fallback = 36): number {
  const raw = pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? fallback;
  return Number(raw);
}

export function buildApplicationPricingSnapshot(opts: {
  listPrice: number;
  offer: Pick<Offer, 'annualRentRate' | 'minDownPaymentPct' | 'tenureOptions'>;
  pricingSnapshot: Record<string, unknown>;
}): Record<string, unknown> {
  const tenureMonths = resolveTenureMonths(opts.pricingSnapshot);
  assertTenureAllowed(tenureMonths, opts.offer.tenureOptions);
  const downPct = clampDownPaymentPct(
    Number(opts.pricingSnapshot.down_payment_pct ?? opts.offer.minDownPaymentPct),
    Number(opts.offer.minDownPaymentPct),
  );
  return buildPricingSnapshot({
    listPrice: opts.listPrice,
    annualRatePercent: Number(opts.offer.annualRentRate),
    minDownPaymentPct: Number(opts.offer.minDownPaymentPct),
    tenureMonths,
    downPaymentPct: downPct,
  });
}

/** Reject client offer shopping — offer must match product default or platform default. */
export function assertOfferMatchesProduct(
  requestedOfferId: string | undefined,
  resolvedOfferId: string,
): void {
  if (requestedOfferId && requestedOfferId !== resolvedOfferId) {
    throw new Error('offer_mismatch');
  }
}

export type ProductWithOfferId = Pick<Product, 'defaultOfferId'>;
