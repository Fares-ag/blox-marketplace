import { BadRequestException } from '@nestjs/common';
import {
  MAX_TENURE_MONTHS,
  MIN_TENURE_MONTHS,
  clampTenureMonths,
  isTenureInRange,
} from '@drivemarket/shared/tenure';

export {
  buildPricingSnapshot,
  clampDownPaymentPct,
  type PricingInput,
  type PricingSnapshot,
} from '@drivemarket/shared/pricing';

export { MAX_TENURE_MONTHS, MIN_TENURE_MONTHS, clampTenureMonths, isTenureInRange };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Preset month options for UI quick-picks (not used for validation). */
export function parseTenureOptions(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [12, 24, 36, 48, 60];
  const parsed = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [12, 24, 36, 48, 60];
}

/**
 * Tenure must sit inside the product band (3–60 months). A plain `Error` here
 * reached the exception filter as a 500, so a customer asking for an
 * out-of-band term got a server error instead of a validation message.
 */
export function assertTenureAllowed(tenureMonths: number, _tenureOptions?: unknown): void {
  void _tenureOptions;
  if (!isTenureInRange(tenureMonths)) {
    throw new BadRequestException('invalid_tenure');
  }
}

export type QuoteGateStatus =
  | 'active'
  | 'requiresAuth'
  | 'wrongEmail'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'notFound';

export function resolveQuoteGate(
  quote: {
    customerEmail: string;
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
    expiredAt?: Date | null;
  },
  viewer?: { role: string; email: string } | null,
): QuoteGateStatus {
  if (quote.revokedAt) return 'revoked';
  if (quote.usedAt) return 'used';
  if (quote.expiredAt || quote.expiresAt.getTime() <= Date.now()) return 'expired';
  if (!viewer || viewer.role !== 'customer') return 'requiresAuth';
  if (normalizeEmail(viewer.email) !== normalizeEmail(quote.customerEmail)) return 'wrongEmail';
  return 'active';
}
