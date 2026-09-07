import { BadRequestException } from '@nestjs/common';
import {
  hasHardViolation,
  validateFinancingRequest,
  type ApplicantKind,
  type ProductRuleViolation,
  type ResidencyClass,
  type VehicleCategory,
} from '@drivemarket/shared/domain-rules';
import { resolveTenureMonths } from './application-pricing';

/**
 * Product-rule validation for every intake path (customer create, draft save,
 * staff create, mobile create). Hard violations are refused with
 * 400 `{ message: 'product_rule_violation', violations }`; soft ones are kept
 * on `pricingSnapshot.rule_flags` so credit sees them during review.
 */

export type ProductRuleEnforcement = {
  /** `PRODUCT_RULES_ENFORCE_FINANCING_CAPS` — financing caps block instead of warn. */
  enforceFinancingCaps: boolean;
  /** `PRODUCT_RULES_ENFORCE_INDIVIDUALS_ONLY` — corporate applicants are refused instead of flagged. */
  enforceIndividualsOnly: boolean;
};

export const PRODUCT_RULE_ENV_KEYS = {
  enforceFinancingCaps: 'PRODUCT_RULES_ENFORCE_FINANCING_CAPS',
  enforceIndividualsOnly: 'PRODUCT_RULES_ENFORCE_INDIVIDUALS_ONLY',
} as const;

export function parseBooleanFlag(value: unknown, fallback = false): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

/** Reads the enforcement flags through any `key → value` reader (ConfigService.get, process.env lookup…). */
export function productRuleEnforcementFrom(read: (key: string) => unknown): ProductRuleEnforcement {
  return {
    enforceFinancingCaps: parseBooleanFlag(read(PRODUCT_RULE_ENV_KEYS.enforceFinancingCaps)),
    enforceIndividualsOnly: parseBooleanFlag(read(PRODUCT_RULE_ENV_KEYS.enforceIndividualsOnly)),
  };
}

export function productRuleEnforcementFromEnv(env: NodeJS.ProcessEnv = process.env): ProductRuleEnforcement {
  return productRuleEnforcementFrom((key) => env[key]);
}

/** Motorcycles are not a listing enum today; they are recognised from the free-form attributes. */
export function vehicleCategoryFor(product: { attributes?: unknown; bodyType?: string | null }): VehicleCategory {
  const haystack: string[] = [];
  if (product.attributes != null) {
    try {
      haystack.push(JSON.stringify(product.attributes));
    } catch {
      /* unserialisable attributes — treat as a car */
    }
  }
  if (product.bodyType) haystack.push(String(product.bodyType));
  return haystack.some((text) => /motor\s?(cycle|bike)/i.test(text)) ? 'motorcycle' : 'car';
}

/** Offer tenure options as numbers, or null when the offer does not constrain them. */
export function offerTenureOptionsOf(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : null;
}

export type ProductRuleInput = {
  product: {
    price: unknown;
    condition?: string | null;
    modelYear?: number | null;
    attributes?: unknown;
    bodyType?: string | null;
  };
  offer: { tenureOptions?: unknown; minDownPaymentPct?: unknown };
  /** The pricing snapshot as it will be stored (server-built: `down_payment_pct`, `tenor`, `selling_price?`). */
  pricingSnapshot: Record<string, unknown>;
  applicantType?: ApplicantKind | null;
  residency?: ResidencyClass | null;
  enforcement?: Partial<ProductRuleEnforcement> | null;
  now?: Date;
};

export function evaluateProductRules(input: ProductRuleInput): ProductRuleViolation[] {
  const pricing = input.pricingSnapshot ?? {};
  const price = Number(pricing.selling_price ?? pricing.list_price ?? input.product.price);
  const tenureMonths = resolveTenureMonths(pricing);
  const downPaymentPct = Number(pricing.down_payment_pct ?? input.offer.minDownPaymentPct ?? 0);
  return validateFinancingRequest({
    applicantType: input.applicantType ?? 'individual',
    residency: input.residency ?? null,
    vehicle: {
      price,
      condition: input.product.condition === 'new' ? 'new' : 'used',
      category: vehicleCategoryFor(input.product),
      modelYear: input.product.modelYear ?? null,
    },
    tenureMonths,
    downPaymentPct,
    offerTenureOptions: offerTenureOptionsOf(input.offer.tenureOptions),
    offerMinDownPaymentPct:
      input.offer.minDownPaymentPct == null ? null : Number(input.offer.minDownPaymentPct),
    enforceFinancingCaps: !!input.enforcement?.enforceFinancingCaps,
    enforceIndividualsOnly: !!input.enforcement?.enforceIndividualsOnly,
    now: input.now,
  });
}

export type RuleFlag = { code: string; params: Record<string, number | string> };

export function softRuleFlags(violations: ProductRuleViolation[]): RuleFlag[] {
  return violations
    .filter((v) => v.severity === 'soft')
    .map((v) => ({ code: v.code, params: { ...v.params } }));
}

/** 400 `product_rule_violation` with the full violation list when any hard rule fails. */
export function assertNoHardViolations(violations: ProductRuleViolation[]): void {
  if (hasHardViolation(violations)) {
    throw new BadRequestException({ message: 'product_rule_violation', violations });
  }
}

/** Pricing snapshot with `rule_flags` set to the soft violations (or removed when there are none). */
export function withRuleFlags(
  pricing: Record<string, unknown>,
  violations: ProductRuleViolation[],
): Record<string, unknown> {
  const { rule_flags: _previous, ...rest } = pricing;
  void _previous;
  const flags = softRuleFlags(violations);
  return flags.length > 0 ? { ...rest, rule_flags: flags } : rest;
}

/** Stored `rule_flags`, tolerant of legacy snapshots without the key. */
export function ruleFlagsOf(pricing: unknown): RuleFlag[] {
  if (!pricing || typeof pricing !== 'object') return [];
  const raw = (pricing as Record<string, unknown>).rule_flags;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      code: String(f.code ?? ''),
      params: f.params && typeof f.params === 'object' ? (f.params as Record<string, number | string>) : {},
    }))
    .filter((f) => f.code);
}
