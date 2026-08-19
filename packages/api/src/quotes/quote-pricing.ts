function estimateMonthlyPayment(opts: {
  price: number;
  downPayment: number;
  annualRatePercent: number;
  tenureMonths: number;
}): number {
  const principal = Math.max(opts.price - opts.downPayment, 0);
  const n = opts.tenureMonths;
  if (n <= 0) return 0;
  const r = opts.annualRatePercent / 100 / 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

export type PricingInput = {
  listPrice: number;
  annualRatePercent: number;
  minDownPaymentPct: number;
  tenureMonths: number;
  downPaymentPct?: number;
};

export function buildPricingSnapshot(input: PricingInput): Record<string, unknown> {
  const safeDownPct = Math.max(input.downPaymentPct ?? input.minDownPaymentPct, input.minDownPaymentPct);
  const downPayment = (input.listPrice * safeDownPct) / 100;
  const monthly = estimateMonthlyPayment({
    price: input.listPrice,
    downPayment,
    annualRatePercent: input.annualRatePercent,
    tenureMonths: input.tenureMonths,
  });
  return {
    list_price: input.listPrice,
    down_payment: downPayment,
    down_payment_pct: safeDownPct,
    tenor: input.tenureMonths,
    rate: input.annualRatePercent,
    monthly: Math.round(monthly),
  };
}

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

export function clampDownPaymentPct(
  downPct: number,
  minDownPaymentPct: number,
  maxPct = 80,
): number {
  const min = Number(minDownPaymentPct);
  const safe = Number.isFinite(downPct) ? downPct : min;
  return Math.min(Math.max(safe, min), maxPct);
}

export type QuoteGateStatus =
  | 'active'
  | 'requiresAuth'
  | 'wrongEmail'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'notFound';

export function resolveQuoteGate(quote: {
  customerEmail: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}, viewer?: { role: string; email: string } | null): QuoteGateStatus {
  if (quote.revokedAt) return 'revoked';
  if (quote.usedAt) return 'used';
  if (quote.expiresAt.getTime() <= Date.now()) return 'expired';
  if (!viewer || viewer.role !== 'customer') return 'requiresAuth';
  if (normalizeEmail(viewer.email) !== normalizeEmail(quote.customerEmail)) return 'wrongEmail';
  return 'active';
}
