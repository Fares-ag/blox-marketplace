import { describe, expect, it } from 'vitest';
import {
  allowedTenureOptions,
  employerCategoryFromEmploymentType,
  downPaymentBounds,
  financingCapFor,
  minDownPaymentPctFor,
  requiredApprovalAuthority,
  residencyFromNationality,
  resolveProductVariant,
  tenureBounds,
  validateFinancingRequest,
} from './product-rules';

const NOW = new Date('2026-09-07T00:00:00Z');

describe('product rules', () => {
  it('resolves the product variant from category, condition and price', () => {
    expect(resolveProductVariant({ price: 80_000, condition: 'new' })).toBe('car_new_standard');
    expect(resolveProductVariant({ price: 120_000, condition: 'new' })).toBe('car_new_premium');
    expect(resolveProductVariant({ price: 120_000, condition: 'used' })).toBe('car_used');
    expect(resolveProductVariant({ price: 30_000, condition: 'new', category: 'motorcycle' })).toBe('motorcycle');
  });

  it('offers the same tenure presets to everyone and adds whatever the offer lists', () => {
    expect(allowedTenureOptions('qatari')).toEqual([12, 24, 36, 48, 60]);
    // The expatriate 48-month figure is a guideline now, not a cut-off.
    expect(allowedTenureOptions('expat')).toEqual([12, 24, 36, 48, 60]);
    // Offer options add to the presets rather than restricting them.
    expect(allowedTenureOptions('expat', [6, 18])).toEqual([6, 12, 18, 24, 36, 48, 60]);
    expect(allowedTenureOptions(null)).toEqual([12, 24, 36, 48, 60]);
    // Anything outside the hard band is dropped from the chips.
    expect(allowedTenureOptions('qatari', [1, 72])).toEqual([12, 24, 36, 48, 60]);
  });

  it('accepts any month and any contribution inside the flexible bands', () => {
    expect(tenureBounds()).toEqual({ min: 3, max: 60 });
    expect(downPaymentBounds()).toEqual({ min: 0, max: 90 });

    const odd = validateFinancingRequest({
      residency: 'expat',
      vehicle: { price: 90_000, condition: 'new', modelYear: 2026 },
      tenureMonths: 37,
      downPaymentPct: 5,
      offerTenureOptions: [12, 24, 36],
      now: NOW,
    });
    // A 37-month term at 5% down: allowed, but every departure is flagged.
    expect(odd.filter((v) => v.severity === 'hard')).toEqual([]);
    expect(odd.map((v) => v.code).sort()).toEqual(['down_payment_below_recommended', 'tenure_not_offered']);
  });

  it('keeps the hard edges of the bands', () => {
    const base = {
      residency: 'qatari' as const,
      vehicle: { price: 90_000, condition: 'new' as const, modelYear: 2026 },
      now: NOW,
    };
    expect(validateFinancingRequest({ ...base, tenureMonths: 2, downPaymentPct: 20 }).map((v) => v.code)).toContain(
      'tenure_below_min',
    );
    expect(validateFinancingRequest({ ...base, tenureMonths: 72, downPaymentPct: 20 }).map((v) => v.code)).toContain(
      'tenure_above_max',
    );
    expect(validateFinancingRequest({ ...base, tenureMonths: 36, downPaymentPct: -1 }).map((v) => v.code)).toContain(
      'down_payment_below_min',
    );
    expect(validateFinancingRequest({ ...base, tenureMonths: 36, downPaymentPct: 95 }).map((v) => v.code)).toContain(
      'down_payment_above_max',
    );
  });

  it('turns the guidelines back into blocks when a stricter product is configured', () => {
    const strict = validateFinancingRequest({
      residency: 'expat',
      vehicle: { price: 90_000, condition: 'new', modelYear: 2026 },
      tenureMonths: 60,
      downPaymentPct: 5,
      enforcePlanGuidelines: true,
      now: NOW,
    });
    expect(strict.map((v) => v.code).sort()).toEqual(['down_payment_below_recommended', 'tenure_above_recommended']);
    expect(strict.every((v) => v.severity === 'hard')).toBe(true);
  });

  it('applies the larger of the product and offer down-payment minimums', () => {
    expect(minDownPaymentPctFor('new', 10)).toBe(20);
    expect(minDownPaymentPctFor('used', 10)).toBe(15);
    expect(minDownPaymentPctFor('used', 25)).toBe(25);
  });

  it('accepts a compliant request', () => {
    const violations = validateFinancingRequest({
      applicantType: 'individual',
      residency: 'expat',
      vehicle: { price: 60_000, condition: 'new', modelYear: 2026 },
      tenureMonths: 48,
      downPaymentPct: 20,
      now: NOW,
    });
    expect(violations).toEqual([]);
  });

  it('flags corporate applicants and vehicle age as hard violations', () => {
    const violations = validateFinancingRequest({
      applicantType: 'corporate',
      residency: 'expat',
      vehicle: { price: 50_000, condition: 'used', modelYear: 2018 },
      tenureMonths: 72,
      downPaymentPct: -5,
      enforceIndividualsOnly: true,
      now: NOW,
    });
    const hard = violations.filter((v) => v.severity === 'hard').map((v) => v.code).sort();
    expect(hard).toEqual(
      ['corporate_not_eligible', 'down_payment_below_min', 'tenure_above_max', 'used_vehicle_too_old', 'vehicle_age_at_tenure_end'].sort(),
    );
  });

  it('reports financing caps as soft unless enforcement is on', () => {
    // Motorcycles are the only capped variant now (QAR 15,000).
    const base = {
      residency: 'qatari' as const,
      vehicle: { price: 30_000, condition: 'new' as const, category: 'motorcycle' as const, modelYear: 2026 },
      tenureMonths: 36,
      downPaymentPct: 20,
      now: NOW,
    };
    const soft = validateFinancingRequest(base);
    expect(soft).toHaveLength(1);
    expect(soft[0]).toMatchObject({ code: 'financing_amount_exceeds_cap', severity: 'soft', params: { cap: 15_000 } });
    const hard = validateFinancingRequest({ ...base, enforceFinancingCaps: true });
    expect(hard[0]?.severity).toBe('hard');
  });

  it('does not cap car financing at any price', () => {
    expect(financingCapFor('car_new_standard')).toBeNull();
    expect(financingCapFor('car_new_premium')).toBeNull();
    expect(financingCapFor('car_used')).toBeNull();
    expect(financingCapFor('motorcycle')).toBe(15_000);

    // A 365,000 vehicle at 20% down finances 292,000 and is still allowed
    // through, even with cap enforcement on.
    const violations = validateFinancingRequest({
      residency: 'qatari',
      vehicle: { price: 365_000, condition: 'new', modelYear: 2026 },
      tenureMonths: 60,
      downPaymentPct: 20,
      enforceFinancingCaps: true,
      now: NOW,
    });
    expect(violations).toEqual([]);
  });

  it('flags corporate applicants for review unless individuals-only is enforced', () => {
    const base = {
      applicantType: 'corporate' as const,
      residency: 'qatari' as const,
      vehicle: { price: 40_000, condition: 'new' as const, modelYear: 2026 },
      tenureMonths: 36,
      downPaymentPct: 20,
      now: NOW,
    };
    expect(validateFinancingRequest(base)).toEqual([{ code: 'corporate_not_eligible', severity: 'soft', params: {} }]);
    expect(validateFinancingRequest({ ...base, enforceIndividualsOnly: true })[0]?.severity).toBe('hard');
  });

  it('rejects tenures the offer does not carry', () => {
    const violations = validateFinancingRequest({
      residency: 'qatari',
      vehicle: { price: 50_000, condition: 'new', modelYear: 2026 },
      tenureMonths: 18,
      downPaymentPct: 20,
      offerTenureOptions: [12, 24, 36],
      now: NOW,
    });
    expect(violations.map((v) => v.code)).toContain('tenure_not_offered');
  });

  it('maps the approval authority matrix', () => {
    expect(requiredApprovalAuthority('car', 40_000)).toBe('senior_manager');
    expect(requiredApprovalAuthority('car', 65_000)).toBe('head_of_credit');
    expect(requiredApprovalAuthority('motorcycle', 16_000)).toBe('above_matrix');
  });

  it('maps intake vocab to the DBR employer category and residency', () => {
    expect(employerCategoryFromEmploymentType('gov-or-semi-gov')).toBe('government');
    expect(employerCategoryFromEmploymentType('self-employed')).toBe('self_employed');
    expect(employerCategoryFromEmploymentType('private-local')).toBe('private_unlisted');
    expect(residencyFromNationality('Qatari')).toBe('qatari');
    expect(residencyFromNationality('India')).toBe('expat');
    expect(residencyFromNationality('')).toBeNull();
  });
});
