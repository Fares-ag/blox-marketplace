import { MAX_TENURE_MONTHS, MIN_TENURE_MONTHS, clampTenureMonths, isTenureInRange } from "@drivemarket/shared/tenure";
export { buildPricingSnapshot, clampDownPaymentPct, type PricingInput, type PricingSnapshot, } from "@drivemarket/shared/pricing";
export { MAX_TENURE_MONTHS, MIN_TENURE_MONTHS, clampTenureMonths, isTenureInRange };
export declare function normalizeEmail(email: string): string;
export declare function parseTenureOptions(raw: unknown): number[];
export declare function assertTenureAllowed(tenureMonths: number, _tenureOptions?: unknown): void;
export type QuoteGateStatus = 'active' | 'requiresAuth' | 'wrongEmail' | 'expired' | 'used' | 'revoked' | 'notFound';
export declare function resolveQuoteGate(quote: {
    customerEmail: string;
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
    expiredAt?: Date | null;
}, viewer?: {
    role: string;
    email: string;
} | null): QuoteGateStatus;
