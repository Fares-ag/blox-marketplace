import type { Prisma } from '@prisma/client';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

function asNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Public offer fields — snake_case, no profitRate or other internals. */
export function toPublicOfferDto(offer: {
  id: string;
  name: string;
  annualRentRate: DecimalLike;
  tenureOptions: Prisma.JsonValue;
  minDownPaymentPct: DecimalLike;
  financePartnerId?: string | null;
  isDefault?: boolean;
  financePartner?: { name?: string | null; crmAdapter?: string | null } | null;
  financingType?: string | null;
}) {
  return {
    id: offer.id,
    name: offer.name,
    annual_rent_rate: asNumber(offer.annualRentRate),
    tenure_options: offer.tenureOptions,
    min_down_payment_pct: asNumber(offer.minDownPaymentPct),
    finance_partner_id: offer.financePartnerId ?? null,
    finance_partner_name: offer.financePartner?.name ?? null,
    crm_adapter: offer.financePartner?.crmAdapter ?? null,
    financing_type: offer.financingType ?? 'diminishing_musharakah',
    ...(offer.isDefault !== undefined ? { is_default: offer.isDefault } : {}),
  };
}

export function toPublicOfferListResponse(
  items: Array<Parameters<typeof toPublicOfferDto>[0]>,
  total: number,
) {
  return { total, items: items.map((item) => toPublicOfferDto(item)) };
}
