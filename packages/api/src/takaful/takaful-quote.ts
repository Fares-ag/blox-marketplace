import type { Prisma, TakafulProvider } from '@prisma/client';
import type { TakafulProviderDto, TakafulQuoteDto } from '../../../shared/src/types/customer-platform';

/**
 * Takaful provider master → indicative quotes. Rates are admin-maintained:
 * comprehensive cover is a percentage of the vehicle value per year (never
 * below the provider's minimum contribution); third-party cover is a flat
 * annual contribution. Nothing here is a binding premium.
 */

export const TAKAFUL_COVERAGES = ['comprehensive', 'third_party'] as const;
export type TakafulCoverage = (typeof TAKAFUL_COVERAGES)[number];

export type TakafulRider = TakafulProviderDto['riders'][number];

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Stored riders JSON (`{ code, label, labelAr, annualAmount }`, snake_case tolerated) → wire shape. */
export function ridersFromProviderJson(raw: unknown): TakafulRider[] {
  if (!Array.isArray(raw)) return [];
  const riders: TakafulRider[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const code = cleanString(r.code);
    const label = cleanString(r.label);
    const annual = decimalToNumber(r.annualAmount ?? r.annual_amount);
    if (!code || !label || annual === null) continue;
    riders.push({
      code,
      label,
      label_ar: cleanString(r.labelAr ?? r.label_ar),
      annual_amount: roundMoney(annual),
    });
  }
  return riders;
}

/** Wire riders → stored JSON (camelCase, as documented on the Prisma model). */
export function ridersToJson(
  riders: Array<{ code: string; label: string; label_ar?: string | null; annual_amount: number }>,
): Prisma.InputJsonValue {
  return riders.map((r) => ({
    code: r.code.trim(),
    label: r.label.trim(),
    labelAr: r.label_ar?.trim() || null,
    annualAmount: roundMoney(r.annual_amount),
  }));
}

export function toTakafulProviderDto(row: TakafulProvider): TakafulProviderDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    name_ar: row.nameAr ?? null,
    comprehensive_rate_pct: decimalToNumber(row.comprehensiveRatePct) ?? 0,
    third_party_annual: decimalToNumber(row.thirdPartyAnnual),
    min_contribution: decimalToNumber(row.minContribution),
    riders: ridersFromProviderJson(row.riders),
    contact_phone: row.contactPhone ?? null,
    contact_email: row.contactEmail ?? null,
    website: row.website ?? null,
    active: row.active,
    sort_order: row.sortOrder,
  };
}

export type TakafulRateCard = Pick<
  TakafulProviderDto,
  'comprehensive_rate_pct' | 'min_contribution' | 'third_party_annual'
>;

/**
 * Annual contribution for one provider, or null when the provider cannot quote
 * that cover (no third-party tariff, or comprehensive without a vehicle value).
 */
export function annualContribution(
  provider: TakafulRateCard,
  coverage: TakafulCoverage,
  vehiclePrice: number | null | undefined,
): number | null {
  if (coverage === 'third_party') {
    return provider.third_party_annual === null || provider.third_party_annual === undefined
      ? null
      : roundMoney(provider.third_party_annual);
  }
  const price = Number(vehiclePrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const byRate = (price * provider.comprehensive_rate_pct) / 100;
  return roundMoney(Math.max(provider.min_contribution ?? 0, byRate));
}

/** Quotes for every active provider that can price the cover, cheapest first (then admin order, then name). */
export function quoteTakaful(
  providers: TakafulProviderDto[],
  coverage: TakafulCoverage,
  vehiclePrice: number | null | undefined,
): TakafulQuoteDto[] {
  const quotes: TakafulQuoteDto[] = [];
  for (const provider of providers) {
    if (!provider.active) continue;
    const annual = annualContribution(provider, coverage, vehiclePrice);
    if (annual === null) continue;
    quotes.push({
      provider,
      coverage_type: coverage,
      annual_contribution: annual,
      monthly_equivalent: roundMoney(annual / 12),
    });
  }
  return quotes.sort(
    (a, b) =>
      a.annual_contribution - b.annual_contribution ||
      a.provider.sort_order - b.provider.sort_order ||
      a.provider.name.localeCompare(b.provider.name),
  );
}
