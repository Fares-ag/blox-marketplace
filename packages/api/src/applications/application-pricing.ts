import { BadRequestException } from '@nestjs/common';
import type { Offer, Product } from '@prisma/client';
import {
  assertTenureAllowed,
  buildPricingSnapshot,
  clampDownPaymentPct,
} from '../quotes/quote-pricing';

export const MIN_ANNUAL_RATE_PERCENT = 0;
export const MAX_ANNUAL_RATE_PERCENT = 30;

export function resolveTenureMonths(pricingSnapshot: Record<string, unknown>, fallback = 36): number {
  const raw = pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? fallback;
  return Number(raw);
}

export function resolveAnnualRatePercent(
  pricingSnapshot: Record<string, unknown>,
  offer: Pick<Offer, 'annualRentRate'>,
): { rate: number; offerRate: number; rateSource: 'override' | 'offer' } {
  const offerRate = Number(offer.annualRentRate);
  const raw = pricingSnapshot.rate;
  if (raw === undefined || raw === null || raw === '') {
    return { rate: offerRate, offerRate, rateSource: 'offer' };
  }
  const requested = Number(raw);
  if (!Number.isFinite(requested) || requested < MIN_ANNUAL_RATE_PERCENT || requested > MAX_ANNUAL_RATE_PERCENT) {
    throw new BadRequestException('invalid_rate');
  }
  return {
    rate: requested,
    offerRate,
    rateSource: requested === offerRate ? 'offer' : 'override',
  };
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
  const resolved = resolveAnnualRatePercent(opts.pricingSnapshot, opts.offer);
  const snapshot = buildPricingSnapshot({
    listPrice: opts.listPrice,
    annualRatePercent: resolved.rate,
    minDownPaymentPct: Number(opts.offer.minDownPaymentPct),
    tenureMonths,
    downPaymentPct: downPct,
  });
  const firstInstallmentDate = opts.pricingSnapshot.first_installment_date;
  return {
    ...snapshot,
    offer_rate: resolved.offerRate,
    rate_source: resolved.rateSource,
    ...(typeof firstInstallmentDate === 'string' && firstInstallmentDate
      ? { first_installment_date: firstInstallmentDate }
      : {}),
  };
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
