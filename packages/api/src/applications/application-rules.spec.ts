import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertNoHardViolations,
  evaluateProductRules,
  offerTenureOptionsOf,
  parseBooleanFlag,
  productRuleEnforcementFrom,
  ruleFlagsOf,
  softRuleFlags,
  vehicleCategoryFor,
  withRuleFlags,
} from './application-rules';

const NOW = new Date('2026-09-07T00:00:00.000Z');
const offer = { tenureOptions: [12, 24, 36, 48, 60], minDownPaymentPct: 10 };
const newCar = { price: 80_000, condition: 'new', modelYear: 2026 };

describe('enforcement flags', () => {
  it('parses boolean-ish env values', () => {
    expect(parseBooleanFlag('true')).toBe(true);
    expect(parseBooleanFlag('1')).toBe(true);
    expect(parseBooleanFlag('off')).toBe(false);
    expect(parseBooleanFlag(undefined)).toBe(false);
    expect(parseBooleanFlag('maybe', true)).toBe(true);
  });

  it('reads both flags through a key reader', () => {
    const env: Record<string, string> = {
      PRODUCT_RULES_ENFORCE_FINANCING_CAPS: 'true',
      PRODUCT_RULES_ENFORCE_INDIVIDUALS_ONLY: 'no',
    };
    expect(productRuleEnforcementFrom((key) => env[key])).toEqual({
      enforceFinancingCaps: true,
      enforceIndividualsOnly: false,
    });
  });
});

describe('evaluateProductRules', () => {
  it('passes a compliant new-car request', () => {
    const violations = evaluateProductRules({
      product: newCar,
      offer,
      pricingSnapshot: { tenor: 36, down_payment_pct: 25, list_price: 60_000 },
      residency: 'qatari',
      now: NOW,
    });
    expect(violations).toEqual([]);
  });

  it('flags a down payment below the product minimum as hard', () => {
    const violations = evaluateProductRules({
      product: newCar,
      offer,
      pricingSnapshot: { tenor: 36, down_payment_pct: 10, list_price: 50_000 },
      residency: 'qatari',
      now: NOW,
    });
    expect(violations).toEqual([{ code: 'down_payment_below_min', severity: 'hard', params: { min: 20 } }]);
  });

  it('caps expat tenure at 48 months and enforces the offer options', () => {
    const violations = evaluateProductRules({
      product: newCar,
      offer,
      pricingSnapshot: { tenor: 60, down_payment_pct: 25, list_price: 60_000 },
      residency: 'expat',
      now: NOW,
    });
    expect(violations.map((v) => v.code)).toEqual(['tenure_above_max']);

    const notOffered = evaluateProductRules({
      product: newCar,
      offer: { ...offer, tenureOptions: [12, 24] },
      pricingSnapshot: { tenor: 36, down_payment_pct: 25, list_price: 60_000 },
      residency: 'qatari',
      now: NOW,
    });
    expect(notOffered.map((v) => v.code)).toEqual(['tenure_not_offered']);
  });

  it('treats financing caps and corporate applicants as soft unless enforced', () => {
    const request = {
      product: { price: 120_000, condition: 'new', modelYear: 2026 },
      offer,
      pricingSnapshot: { tenor: 36, down_payment_pct: 20, list_price: 120_000 },
      applicantType: 'corporate' as const,
      residency: 'qatari' as const,
      now: NOW,
    };
    const soft = evaluateProductRules(request);
    expect(soft.map((v) => [v.code, v.severity])).toEqual([
      ['corporate_not_eligible', 'soft'],
      ['financing_amount_exceeds_cap', 'soft'],
    ]);
    const hard = evaluateProductRules({
      ...request,
      enforcement: { enforceFinancingCaps: true, enforceIndividualsOnly: true },
    });
    expect(hard.every((v) => v.severity === 'hard')).toBe(true);
  });

  it('uses the selling price when the staff wizard negotiated one', () => {
    const violations = evaluateProductRules({
      product: { price: 200_000, condition: 'used', modelYear: 2024 },
      offer,
      pricingSnapshot: { tenor: 36, down_payment_pct: 75, list_price: 200_000, selling_price: 100_000 },
      residency: 'qatari',
      now: NOW,
    });
    // 25% of 100k = 25k financed — within the 50k used-car cap.
    expect(violations).toEqual([]);
  });
});

describe('rule flags', () => {
  const violations = [
    { code: 'financing_amount_exceeds_cap' as const, severity: 'soft' as const, params: { cap: 50_000, financed: 64_000, variant: 'car_new_standard' } },
    { code: 'tenure_below_min' as const, severity: 'hard' as const, params: { min: 3 } },
  ];

  it('keeps only the soft violations on the pricing snapshot', () => {
    expect(softRuleFlags(violations)).toEqual([
      { code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 64_000, variant: 'car_new_standard' } },
    ]);
    const pricing = withRuleFlags({ tenor: 36, rule_flags: [{ code: 'stale' }] }, violations);
    expect(pricing).toEqual({
      tenor: 36,
      rule_flags: [{ code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 64_000, variant: 'car_new_standard' } }],
    });
    expect(withRuleFlags({ tenor: 36, rule_flags: [{ code: 'stale' }] }, [])).toEqual({ tenor: 36 });
  });

  it('reads stored flags defensively', () => {
    expect(ruleFlagsOf(null)).toEqual([]);
    expect(ruleFlagsOf({ rule_flags: 'nope' })).toEqual([]);
    expect(ruleFlagsOf({ rule_flags: [{ code: 'x', params: { a: 1 } }, { nope: true }, null] })).toEqual([
      { code: 'x', params: { a: 1 } },
    ]);
  });

  it('assertNoHardViolations throws 400 product_rule_violation with the violations', () => {
    expect(() => assertNoHardViolations(violations.filter((v) => v.severity === 'soft'))).not.toThrow();
    try {
      assertNoHardViolations(violations);
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { message: string; violations: unknown[] };
      expect(response.message).toBe('product_rule_violation');
      expect(response.violations).toHaveLength(2);
    }
  });
});

describe('vehicle helpers', () => {
  it('recognises motorcycles from the free-form attributes', () => {
    expect(vehicleCategoryFor({ attributes: null })).toBe('car');
    expect(vehicleCategoryFor({ attributes: [{ key: 'type', value: 'Motorcycle' }] })).toBe('motorcycle');
    expect(vehicleCategoryFor({ attributes: { vehicle_type: 'motorbike' } })).toBe('motorcycle');
    expect(vehicleCategoryFor({ bodyType: 'suv' })).toBe('car');
  });

  it('parses offer tenure options or returns null when unconstrained', () => {
    expect(offerTenureOptionsOf([12, '24', 'x'])).toEqual([12, 24]);
    expect(offerTenureOptionsOf([])).toBeNull();
    expect(offerTenureOptionsOf('12,24')).toBeNull();
  });
});
