import type { Offer, Product } from '@prisma/client';
export declare function resolveTenureMonths(pricingSnapshot: Record<string, unknown>, fallback?: number): number;
export declare function buildApplicationPricingSnapshot(opts: {
    listPrice: number;
    offer: Pick<Offer, 'annualRentRate' | 'minDownPaymentPct' | 'tenureOptions'>;
    pricingSnapshot: Record<string, unknown>;
}): Record<string, unknown>;
export declare function assertOfferMatchesProduct(requestedOfferId: string | undefined, resolvedOfferId: string): void;
export type ProductWithOfferId = Pick<Product, 'defaultOfferId'>;
