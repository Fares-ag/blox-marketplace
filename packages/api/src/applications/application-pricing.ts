import { BadRequestException } from '@nestjs/common';
import type { Offer, Product } from '@prisma/client';
import {
  balloonPricingOverlay,
  buildBalloonInstallmentPlan,
  isValidBalloonStructure,
  resolveBalloonStructure,
} from '@drivemarket/shared/installment-plan';
import { isInHouseFinance } from '@drivemarket/shared/domain-rules';
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
  financePartnerCode?: string | null;
}): Record<string, unknown> {
  const tenureMonths = resolveTenureMonths(opts.pricingSnapshot);
  assertTenureAllowed(tenureMonths, opts.offer.tenureOptions, {
    lenderCode: opts.financePartnerCode,
  });
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
  const base = {
    ...snapshot,
    offer_rate: resolved.offerRate,
    rate_source: resolved.rateSource,
    ...(typeof firstInstallmentDate === 'string' && firstInstallmentDate
      ? { first_installment_date: firstInstallmentDate }
      : {}),
  };

  const wantsBalloon =
    opts.pricingSnapshot.calculation_method === 'balloon_payment' || Number(opts.pricingSnapshot.balloon_pct) > 0;
  if (!wantsBalloon) return base;
  if (!isInHouseFinance(opts.financePartnerCode)) return base;

  const structure = resolveBalloonStructure(downPct, Number(opts.pricingSnapshot.balloon_pct));
  if (!isValidBalloonStructure(structure)) {
    throw new BadRequestException('invalid_balloon_structure');
  }
  const startDate =
    typeof firstInstallmentDate === 'string' && firstInstallmentDate
      ? new Date(`${firstInstallmentDate}T00:00:00.000Z`)
      : new Date('2026-01-01T00:00:00.000Z');
  const plan = buildBalloonInstallmentPlan({
    vehiclePrice: opts.listPrice,
    downPaymentPercent: structure.downPaymentPercent,
    balloonPercent: structure.balloonPercent,
    termMonths: tenureMonths,
    annualRatePercent: resolved.rate,
    startDate,
  });
  return {
    ...base,
    ...balloonPricingOverlay(plan),
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
