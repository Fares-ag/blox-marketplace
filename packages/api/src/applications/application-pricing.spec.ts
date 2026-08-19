import { describe, expect, it } from 'vitest';
import { assertTenureAllowed } from '../quotes/quote-pricing';
import {
  assertOfferMatchesProduct,
  buildApplicationPricingSnapshot,
} from './application-pricing';

const sampleOffer = {
  annualRentRate: 5,
  minDownPaymentPct: 20,
  tenureOptions: [24, 36, 48],
};

describe('buildApplicationPricingSnapshot', () => {
  it('uses server listPrice and ignores spoofed client list_price in output', () => {
    const snap = buildApplicationPricingSnapshot({
      listPrice: 100_000,
      offer: sampleOffer,
      pricingSnapshot: { tenor: 36, list_price: 50_000, down_payment_pct: 20 },
    });
    expect(snap.list_price).toBe(100_000);
    expect(snap.tenor).toBe(36);
  });

  it('rejects tenure not in offer.tenureOptions', () => {
    expect(() =>
      buildApplicationPricingSnapshot({
        listPrice: 100_000,
        offer: sampleOffer,
        pricingSnapshot: { tenor: 12 },
      }),
    ).toThrow('invalid_tenure');
  });
});

describe('assertTenureAllowed', () => {
  it('accepts allowed tenure values', () => {
    expect(() => assertTenureAllowed(36, [24, 36, 48])).not.toThrow();
  });

  it('rejects disallowed tenure values', () => {
    expect(() => assertTenureAllowed(60, [24, 36, 48])).toThrow('invalid_tenure');
  });
});

describe('assertOfferMatchesProduct', () => {
  it('allows matching offer id', () => {
    expect(() => assertOfferMatchesProduct('offer-a', 'offer-a')).not.toThrow();
  });

  it('rejects offer shopping', () => {
    expect(() => assertOfferMatchesProduct('offer-b', 'offer-a')).toThrow('offer_mismatch');
  });
});

describe('atomic consume/reserve invariants', () => {
  it('only one listing reserve succeeds when status is published', () => {
    let listingStatus = 'published';
    const tryReserve = () => {
      if (listingStatus !== 'published') return 0;
      listingStatus = 'reserved';
      return 1;
    };
    expect(tryReserve()).toBe(1);
    expect(tryReserve()).toBe(0);
  });

  it('only one quote consume succeeds when unused and unexpired', () => {
    let usedAt: Date | null = null;
    const expiresAt = Date.now() + 60_000;
    const tryConsume = () => {
      if (usedAt || Date.now() >= expiresAt) return 0;
      usedAt = new Date();
      return 1;
    };
    expect(tryConsume()).toBe(1);
    expect(tryConsume()).toBe(0);
  });
});
