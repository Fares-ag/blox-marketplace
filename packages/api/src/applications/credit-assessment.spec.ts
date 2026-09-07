import { describe, expect, it } from 'vitest';
import {
  approverFor,
  assessApplicationCredit,
  creditAssessmentColumns,
  creditAssessmentData,
  creditAssessmentInputFor,
  creditAssessedLogMetadata,
  financedAmountOf,
  guarantorMonthlyIncomeOf,
  monthlyIncomeOf,
  ruleViolationsOf,
  toAffordabilityDto,
  toCreditAssessmentDto,
} from './credit-assessment';

/** Expat (India, born 1990), private-local employer, QAR 12,000 net, QAR 1,500 liabilities. */
const EXPAT = {
  full_name: 'Priya Nair',
  phone: '+97455512345',
  qid: '29035612345',
  applicantType: 'individual',
  employment: { employmentType: 'private-local', salary: 12_000 },
  monthlyLiabilities: 1_500,
};

/** QAR 80,000 car, 20% down → QAR 64,000 financed over 36 months. */
const PRICING = {
  list_price: 80_000,
  down_payment: 16_000,
  down_payment_pct: 20,
  tenor: 36,
  rate: 12,
  monthly: 2_126.28,
  financed_total: 76_546.08,
  rule_flags: [{ code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 64_000 } }],
};

const NOW = new Date('2026-09-07T00:00:00.000Z');

describe('credit-assessment input derivation', () => {
  it('reads the income as monthlyIncome, then income, then employment.salary', () => {
    expect(monthlyIncomeOf(EXPAT)).toBe(12_000);
    expect(monthlyIncomeOf({ ...EXPAT, income: 9_000 })).toBe(9_000);
    expect(monthlyIncomeOf({ ...EXPAT, income: 9_000, monthlyIncome: 11_000 })).toBe(11_000);
    expect(monthlyIncomeOf({ ...EXPAT, employment: { employmentType: 'private-local' } })).toBeNull();
    expect(monthlyIncomeOf({ ...EXPAT, employment: { employmentType: 'private-local', salary: 0 } })).toBeNull();
  });

  it('derives the financed amount from the snapshot, preferring an explicit value', () => {
    expect(financedAmountOf(PRICING)).toBe(64_000);
    expect(financedAmountOf({ ...PRICING, financed_amount: 61_000 })).toBe(61_000);
    expect(financedAmountOf({ ...PRICING, selling_price: 75_000 })).toBe(59_000);
    expect(financedAmountOf(null)).toBe(0);
  });

  it('maps residency, employer category, liabilities, installment and flags', () => {
    const { input, financedAmount, monthlyInstallment } = creditAssessmentInputFor({
      customerSnapshot: EXPAT,
      pricingSnapshot: PRICING,
      product: { bodyType: 'sedan' },
    });
    expect(financedAmount).toBe(64_000);
    expect(monthlyInstallment).toBe(2_126.28);
    expect(input.vehicleCategory).toBe('car');
    expect(input.affordability).toEqual({
      monthlyIncome: 12_000,
      monthlyLiabilities: 1_500,
      proposedInstallment: 2_126.28,
      residency: 'expat',
      employerCategory: 'private_unlisted',
      financedAmount: 64_000,
    });
    expect(input.ruleFlags).toEqual([
      { code: 'financing_amount_exceeds_cap', severity: 'soft', params: { cap: 50_000, financed: 64_000 } },
    ]);
    expect(input.guarantorMonthlyIncome).toBeNull();
  });

  it('maps the employer categories used by the DBR matrix', () => {
    const category = (employmentType: string) =>
      creditAssessmentInputFor({
        customerSnapshot: { ...EXPAT, employment: { employmentType, salary: 12_000 } },
        pricingSnapshot: PRICING,
      }).input.affordability?.employerCategory;
    expect(category('gov-or-semi-gov')).toBe('government');
    expect(category('private-international')).toBe('private_approved');
    expect(category('self-employed')).toBe('self_employed');
    expect(category('private-local')).toBe('private_unlisted');
  });

  it('counts the guarantor income only when a guarantor is declared', () => {
    const guarantor = { fullName: 'Arjun Nair', qid: '28535612345', phone: '+97455598765', relationship: 'spouse', monthlyIncome: 8_000 };
    expect(guarantorMonthlyIncomeOf({ ...EXPAT, hasGuarantor: true, guarantor })).toBe(8_000);
    expect(guarantorMonthlyIncomeOf({ ...EXPAT, hasGuarantor: false, guarantor })).toBeNull();
    expect(guarantorMonthlyIncomeOf({ ...EXPAT, hasGuarantor: true, guarantor: { ...guarantor, monthlyIncome: undefined } })).toBeNull();
  });

  it('recognises motorcycles from the listing body type or attributes', () => {
    const bike = creditAssessmentInputFor({
      customerSnapshot: EXPAT,
      pricingSnapshot: PRICING,
      product: { bodyType: 'motorcycle' },
    });
    expect(bike.input.vehicleCategory).toBe('motorcycle');
    const tagged = creditAssessmentInputFor({
      customerSnapshot: EXPAT,
      pricingSnapshot: PRICING,
      product: { attributes: [{ key: 'type', value: 'Motor bike' }] },
    });
    expect(tagged.input.vehicleCategory).toBe('motorcycle');
    expect(creditAssessmentInputFor({ customerSnapshot: EXPAT, pricingSnapshot: PRICING }).input.vehicleCategory).toBe('car');
  });

  it('converts stored soft flags to the shared violation shape', () => {
    expect(ruleViolationsOf({ rule_flags: [{ code: 'x', params: { a: 1 } }] })).toEqual([
      { code: 'x', severity: 'soft', params: { a: 1 } },
    ]);
    expect(ruleViolationsOf({})).toEqual([]);
  });
});

describe('assessApplicationCredit', () => {
  it('refers a within-cap case that carries a soft rule flag, at head-of-credit authority', () => {
    const assessed = assessApplicationCredit({ customerSnapshot: EXPAT, pricingSnapshot: PRICING }, NOW);
    expect(assessed.assessment.affordability?.status).toBe('within_cap');
    expect(assessed.assessment.affordability?.dbr).toBeCloseTo(0.3022, 3);
    expect(assessed.assessment.affordability?.stressed?.withinLimit).toBe(true);
    expect(assessed.assessment.approvalAuthority).toBe('head_of_credit');
    expect(assessed.assessment.path).toBe('refer');
    expect(assessed.assessment.reasons).toEqual(['soft_rule_flags']);
    expect(assessed.assessment.assessedAt).toBe(NOW.toISOString());
  });

  it('approves the same case without flags', () => {
    const { rule_flags: _flags, ...clean } = PRICING;
    void _flags;
    const assessed = assessApplicationCredit({ customerSnapshot: EXPAT, pricingSnapshot: clean }, NOW);
    expect(assessed.assessment.path).toBe('approve');
    expect(assessed.assessment.reasons).toEqual([]);
  });

  it('refers when the income is unknown', () => {
    const assessed = assessApplicationCredit(
      { customerSnapshot: { ...EXPAT, employment: { employmentType: 'private-local' } }, pricingSnapshot: PRICING },
      NOW,
    );
    expect(assessed.assessment.affordability).toBeNull();
    expect(assessed.assessment.path).toBe('refer');
    expect(assessed.assessment.reasons).toContain('affordability_unknown');
  });

  it('declines above the hard cap unless the guarantor income brings it back', () => {
    const stretched = { ...EXPAT, employment: { employmentType: 'private-local', salary: 4_000 }, monthlyLiabilities: 1_500 };
    const declined = assessApplicationCredit({ customerSnapshot: stretched, pricingSnapshot: PRICING }, NOW);
    expect(declined.assessment.affordability?.status).toBe('above_hard_cap');
    expect(declined.assessment.path).toBe('decline');
    expect(declined.assessment.reasons).toContain('dbr_above_hard_cap');

    const withGuarantor = assessApplicationCredit(
      {
        customerSnapshot: {
          ...stretched,
          hasGuarantor: true,
          guarantor: { fullName: 'Arjun Nair', qid: '28535612345', phone: '+97455598765', relationship: 'spouse', monthlyIncome: 8_000 },
        },
        pricingSnapshot: PRICING,
      },
      NOW,
    );
    expect(withGuarantor.assessment.affordabilityWithGuarantor?.status).toBe('within_cap');
    expect(withGuarantor.assessment.path).toBe('refer');
    expect(withGuarantor.assessment.reasons).toContain('within_cap_with_guarantor');
  });

  it('puts a QAR 64,000 motorcycle above the approval matrix', () => {
    const assessed = assessApplicationCredit(
      { customerSnapshot: EXPAT, pricingSnapshot: PRICING, product: { bodyType: 'motorcycle' } },
      NOW,
    );
    expect(assessed.assessment.approvalAuthority).toBe('above_matrix');
    expect(assessed.assessment.reasons).toContain('above_approval_matrix');
  });
});

describe('credit assessment DTO', () => {
  const assessed = assessApplicationCredit({ customerSnapshot: EXPAT, pricingSnapshot: PRICING }, NOW);

  it('matches CreditAssessmentDto field for field, with the approver block for the caller', () => {
    const dto = toCreditAssessmentDto(assessed, 'credit_officer');
    expect(Object.keys(dto).sort()).toEqual(
      [
        'affordability',
        'affordability_with_guarantor',
        'approval_authority',
        'path',
        'reasons',
        'rule_flags',
        'assessed_at',
        'financed_amount',
        'monthly_installment',
        'approver',
      ].sort(),
    );
    expect(dto.affordability).toMatchObject({
      cap: 0.5,
      hard_cap: 0.75,
      status: 'within_cap',
      exception_tier: 0,
      stressed: { within_limit: true },
    });
    expect(Object.keys(dto.affordability!).sort()).toEqual(
      ['dbr', 'cap', 'hard_cap', 'status', 'exception_tier', 'max_installment_within_cap', 'headroom', 'stressed'].sort(),
    );
    expect(dto.affordability_with_guarantor).toBeNull();
    expect(dto.approval_authority).toBe('head_of_credit');
    expect(dto.financed_amount).toBe(64_000);
    expect(dto.monthly_installment).toBe(2_126.28);
    expect(dto.rule_flags).toEqual([
      { code: 'financing_amount_exceeds_cap', severity: 'soft', params: { cap: 50_000, financed: 64_000 } },
    ]);
    expect(dto.approver).toEqual({
      role_may_approve: false,
      required_roles: ['admin', 'super_admin'],
      max_tier_for_role: 1,
    });
    expect(toCreditAssessmentDto(assessed, 'admin').approver).toEqual({
      role_may_approve: true,
      required_roles: ['admin', 'super_admin'],
      max_tier_for_role: 2,
    });
  });

  it('stores a neutral approver block on the persisted copy', () => {
    const columns = creditAssessmentColumns(assessed);
    expect(columns.approvalAuthority).toBe('head_of_credit');
    expect(columns.creditAssessment.approver).toEqual({
      role_may_approve: false,
      required_roles: ['admin', 'super_admin'],
      max_tier_for_role: 0,
    });
    expect(approverFor(null, 'senior_manager')).toEqual({
      role_may_approve: false,
      required_roles: ['credit_officer', 'admin', 'super_admin'],
      max_tier_for_role: 0,
    });
    expect(approverFor('partner_viewer', 'senior_manager').role_may_approve).toBe(false);
    const data = creditAssessmentData(assessed);
    expect(data.approvalAuthority).toBe('head_of_credit');
    expect((data.creditAssessment as { path: string }).path).toBe('refer');
  });

  it('serialises an unknown affordability as null and infinite DBRs safely', () => {
    expect(toAffordabilityDto(null)).toBeNull();
    expect(
      toAffordabilityDto({
        dbr: Number.POSITIVE_INFINITY,
        cap: 0.5,
        hardCap: 0.75,
        status: 'above_hard_cap',
        exceptionTier: 3,
        maxInstallmentWithinCap: 0,
        headroom: 0,
      }).dbr,
    ).toBe(99);
  });

  it('logs the path and authority for the audit trail', () => {
    expect(creditAssessedLogMetadata(assessed, 'submit')).toMatchObject({
      stage: 'submit',
      path: 'refer',
      authority: 'head_of_credit',
      reasons: ['soft_rule_flags'],
      financed_amount: 64_000,
      exception_tier: 0,
    });
  });
});
