export {
  buildPricingSnapshot,
  clampDownPaymentPct,
  type PricingInput,
  type PricingSnapshot,
} from '@drivemarket/shared/pricing';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseTenureOptions(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [12, 24, 36, 48, 60];
  const parsed = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [12, 24, 36, 48, 60];
}

export function assertTenureAllowed(tenureMonths: number, tenureOptions: unknown): void {
  const allowed = parseTenureOptions(tenureOptions);
  if (!Number.isFinite(tenureMonths) || tenureMonths <= 0 || !allowed.includes(tenureMonths)) {
    throw new Error('invalid_tenure');
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
