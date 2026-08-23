import type { Prisma } from '@prisma/client';
import { toPublicOfferDto } from '../common/offer-response.dto';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

function asNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toDealerQuoteDto(quote: {
  id: string;
  token: string;
  url: string;
  customerEmail: string;
  negotiatedPrice: DecimalLike;
  listPriceSnapshot: DecimalLike;
  expiresAt: string;
  status: string;
  product: { make: string; model: string; modelYear: number; slug: string };
}) {
  return {
    id: quote.id,
    token: quote.token,
    url: quote.url,
    customer_email: quote.customerEmail,
    negotiated_price: asNumber(quote.negotiatedPrice),
    list_price_snapshot: asNumber(quote.listPriceSnapshot),
    expires_at: quote.expiresAt,
    status: quote.status,
    product: {
      make: quote.product.make,
      model: quote.product.model,
      model_year: quote.product.modelYear,
      slug: quote.product.slug,
    },
  };
}

export function toDealerQuoteListItemDto(quote: {
  id: string;
  token: string;
  url: string;
  customerEmail: string;
  negotiatedPrice: DecimalLike;
  listPriceSnapshot: DecimalLike;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: string;
  product: { make: string; model: string; modelYear: number; slug: string };
  createdBy: { name: string | null; email: string };
}) {
  return {
    id: quote.id,
    token: quote.token,
    url: quote.url,
    customer_email: quote.customerEmail,
    negotiated_price: asNumber(quote.negotiatedPrice),
    list_price_snapshot: asNumber(quote.listPriceSnapshot),
    expires_at: quote.expiresAt,
    used_at: quote.usedAt,
    revoked_at: quote.revokedAt,
    created_at: quote.createdAt,
    status: quote.status,
    product: {
      make: quote.product.make,
      model: quote.product.model,
      model_year: quote.product.modelYear,
      slug: quote.product.slug,
    },
    created_by: {
      name: quote.createdBy.name,
      email: quote.createdBy.email,
    },
  };
}

export function toQuoteRevokeDto(result: { id: string; status: string }) {
  return { id: result.id, status: result.status };
}

export function toPublicQuoteResolveDto(input: {
  gate: string;
  token: string;
  expiresAt: string;
  customerEmailMasked: string;
  product: {
    id: string;
    slug: string;
    make: string;
    model: string;
    trim: string | null;
    modelYear: number;
    condition: string;
    mileage: number | null;
    color: string | null;
    publicListPrice: number;
    financeEligible: boolean;
    listingStatus: string;
    imagePath: string | null;
  };
  company: {
    id: string;
    name: string;
    code: string | null;
    logoUrl: string | null;
  };
  negotiatedPrice?: number;
  listPriceSnapshot?: number;
  offer?: {
    id: string;
    name: string;
    annualRentRate: DecimalLike;
    tenureOptions: Prisma.JsonValue;
    minDownPaymentPct: DecimalLike;
  };
}) {
  const base = {
    gate: input.gate,
    token: input.token,
    expires_at: input.expiresAt,
    customer_email_masked: input.customerEmailMasked,
    product: {
      id: input.product.id,
      slug: input.product.slug,
      make: input.product.make,
      model: input.product.model,
      trim: input.product.trim,
      model_year: input.product.modelYear,
      condition: input.product.condition,
      mileage: input.product.mileage,
      color: input.product.color,
      public_list_price: input.product.publicListPrice,
      finance_eligible: input.product.financeEligible,
      listing_status: input.product.listingStatus,
      image_path: input.product.imagePath,
    },
    company: {
      id: input.company.id,
      name: input.company.name,
      code: input.company.code,
      logo_url: input.company.logoUrl,
    },
  };

  if (input.gate !== 'active') {
    return base;
  }

  return {
    ...base,
    negotiated_price: input.negotiatedPrice ?? null,
    list_price_snapshot: input.listPriceSnapshot ?? null,
    offer: input.offer ? toPublicOfferDto(input.offer) : null,
  };
}
