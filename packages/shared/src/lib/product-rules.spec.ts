import { describe, expect, it } from 'vitest';
import {
  allowedTenureOptions,
  employerCategoryFromEmploymentType,
  minDownPaymentPctFor,
  requiredApprovalAuthority,
  residencyFromNationality,
  resolveProductVariant,
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

  it('caps tenure per nationality and honours the offer options', () => {
    expect(allowedTenureOptions('qatari')).toEqual([12, 24, 36, 48, 60]);
    expect(allowedTenureOptions('expat')).toEqual([12, 24, 36, 48]);
    expect(allowedTenureOptions('expat', [24, 36, 60])).toEqual([24, 36]);
    expect(allowedTenureOptions(null)).toEqual([12, 24, 36, 48, 60]);
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

  it('flags tenure, down payment, corporate applicants and vehicle age as hard violations', () => {
    const violations = validateFinancingRequest({
      applicantType: 'corporate',
      residency: 'expat',
      vehicle: { price: 50_000, condition: 'used', modelYear: 2018 },
      tenureMonths: 60,
      downPaymentPct: 10,
      enforceIndividualsOnly: true,
      now: NOW,
    });
    const codes = violations.map((v) => v.code).sort();
    expect(codes).toEqual(
      ['corporate_not_eligible', 'down_payment_below_min', 'tenure_above_max', 'used_vehicle_too_old', 'vehicle_age_at_tenure_end'].sort(),
    );
    expect(violations.every((v) => v.severity === 'hard')).toBe(true);
  });

  it('reports financing caps as soft unless enforcement is on', () => {
    const base = {
      residency: 'qatari' as const,
      vehicle: { price: 150_000, condition: 'new' as const, modelYear: 2026 },
      tenureMonths: 60,
      downPaymentPct: 20,
      now: NOW,
    };
    const soft = validateFinancingRequest(base);
    expect(soft).toHaveLength(1);
    expect(soft[0]).toMatchObject({ code: 'financing_amount_exceeds_cap', severity: 'soft', params: { cap: 70_000 } });
    const hard = validateFinancingRequest({ ...base, enforceFinancingCaps: true });
    expect(hard[0]?.severity).toBe('hard');
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
