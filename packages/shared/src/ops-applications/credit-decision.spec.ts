import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import type { AffordabilityDto, CreditAssessmentDto } from '../types/customer-platform';
import type { IntakeTranslate } from './customer-info';
import {
  approveBlockReason,
  creditPathVariant,
  dbrGaugeModel,
  decisionErrorCode,
  decisionErrorMessage,
  effectiveExceptionTier,
  formatDbrPct,
} from './credit-decision';

const t: IntakeTranslate = (key, options) => {
  const params = Object.entries(options ?? {})
    .filter(([name]) => name !== 'defaultValue')
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(';');
  return params ? `${key}[${params}]` : key;
};

function affordability(overrides: Partial<AffordabilityDto> = {}): AffordabilityDto {
  return {
    dbr: 0.42,
    cap: 0.5,
    hard_cap: 0.75,
    status: 'within_cap',
    exception_tier: 0,
    max_installment_within_cap: 4000,
    headroom: 800,
    stressed: null,
    ...overrides,
  };
}

function assessment(overrides: Partial<CreditAssessmentDto> = {}): CreditAssessmentDto {
  return {
    affordability: affordability(),
    affordability_with_guarantor: null,
    approval_authority: 'senior_manager',
    path: 'approve',
    reasons: [],
    rule_flags: [],
    assessed_at: '2026-09-07T00:00:00.000Z',
    financed_amount: 80_000,
    monthly_installment: 3200,
    approver: { role_may_approve: true, required_roles: ['credit_officer', 'admin', 'super_admin'], max_tier_for_role: 3 },
    ...overrides,
  };
}

describe('decision enforcement errors', () => {
  it('maps the three approval codes with their details', () => {
    const authority = new ApiError('x', 403, 'approval_authority_required', {
      required_roles: ['admin', 'super_admin'],
      authority: 'head_of_credit',
    });
    expect(decisionErrorCode(authority)).toBe('approval_authority_required');
    expect(decisionErrorMessage(authority, t)).toBe(
      'dealerOps.decision.approvalAuthorityRequired[roles=dealerOps.creditAssessment.role.admin, dealerOps.creditAssessment.role.super_admin;authority=dealerOps.creditAssessment.authorityLevel.head_of_credit]',
    );
    expect(decisionErrorMessage(new ApiError('x', 403, 'dbr_exception_escalation_required', { tier: 2 }), t)).toBe(
      'dealerOps.decision.escalationRequired[tier=2]',
    );
    expect(decisionErrorMessage(new ApiError('x', 409, 'dbr_above_hard_cap'), t)).toBe('dealerOps.decision.aboveHardCap');
  });

  it('ignores unrelated errors', () => {
    expect(decisionErrorMessage(new ApiError('x', 409, 'documents_missing'), t)).toBeNull();
    expect(decisionErrorMessage(new Error('network'), t)).toBeNull();
  });
});

describe('approveBlockReason', () => {
  it('lets an officer within the matrix and tier approve', () => {
    expect(approveBlockReason({ assessment: assessment(), role: 'credit_officer', t })).toBeNull();
  });

  it('never blocks when the assessment is unknown (the API still enforces)', () => {
    expect(approveBlockReason({ assessment: null, role: 'credit_officer', t })).toBeNull();
  });

  it('blocks everyone but credit and super admin above the hard cap', () => {
    const declined = assessment({
      path: 'decline',
      reasons: ['dbr_above_hard_cap'],
      affordability: affordability({ dbr: 0.8, status: 'above_hard_cap', exception_tier: 3 }),
      approver: { role_may_approve: true, required_roles: ['credit_officer'], max_tier_for_role: 3 },
    });
    expect(approveBlockReason({ assessment: declined, role: 'credit_officer', t })).toBeNull();
    expect(approveBlockReason({ assessment: declined, role: 'admin', t })?.code).toBe('hard_cap');
    expect(approveBlockReason({ assessment: declined, role: 'super_admin', t })).toBeNull();
  });

  it('blocks on the approval matrix before the tier', () => {
    const aboveMatrix = assessment({
      approval_authority: 'above_matrix',
      approver: { role_may_approve: false, required_roles: ['credit_officer', 'admin', 'super_admin'], max_tier_for_role: 1 },
    });
    const block = approveBlockReason({ assessment: aboveMatrix, role: 'finance_officer', t });
    expect(block?.code).toBe('authority');
    expect(block?.message).toContain('dealerOps.creditAssessment.role.credit_officer');
    expect(block?.message).toContain('authorityLevel.above_matrix');
  });

  it('blocks a tier the role may not sign off, using the guarantor variant when present', () => {
    const tier2 = assessment({
      path: 'refer',
      reasons: ['dbr_exception_tier_2'],
      affordability: affordability({ dbr: 0.6, status: 'exception_tier_3', exception_tier: 3 }),
      affordability_with_guarantor: affordability({ dbr: 0.54, status: 'exception_tier_2', exception_tier: 2 }),
    });
    expect(effectiveExceptionTier(tier2)).toBe(2);
    expect(approveBlockReason({ assessment: tier2, role: 'credit_officer', t })).toBeNull();
    const tier2Finance = {
      ...tier2,
      approver: { role_may_approve: true, required_roles: ['credit_officer', 'finance_officer'], max_tier_for_role: 1 },
    };
    expect(approveBlockReason({ assessment: tier2Finance, role: 'finance_officer', t })).toEqual({
      code: 'tier',
      message: 'dealerOps.decision.escalationRequired[tier=2]',
    });
    expect(
      approveBlockReason({
        assessment: { ...tier2, approver: { ...tier2.approver, max_tier_for_role: 2 } },
        role: 'admin',
        t,
      }),
    ).toBeNull();
  });
});

describe('DBR gauge model', () => {
  it('scales the ratio to percentages and picks the tone from the status', () => {
    const model = dbrGaugeModel(affordability({ dbr: 0.4321 }));
    expect(model).toMatchObject({ dbrPct: 43.2, capPct: 50, hardCapPct: 75, fillPct: 43.2, tone: 'success' });
    expect(dbrGaugeModel(affordability({ dbr: 0.53, status: 'exception_tier_1', exception_tier: 1 })).tone).toBe('warning');
    expect(dbrGaugeModel(affordability({ dbr: 0.9, status: 'above_hard_cap', exception_tier: 3 })).tone).toBe('danger');
  });

  it('clamps an unknown income (infinite ratio) to a full bar', () => {
    const model = dbrGaugeModel(affordability({ dbr: Number.POSITIVE_INFINITY, status: 'above_hard_cap', exception_tier: 3 }));
    expect(model.fillPct).toBe(100);
    expect(formatDbrPct(model.dbrPct)).toBe('—');
    expect(formatDbrPct(0.4321)).toBe('43.2');
  });

  it('maps the credit path to a pill variant', () => {
    expect(creditPathVariant('approve')).toBe('success');
    expect(creditPathVariant('refer')).toBe('warning');
    expect(creditPathVariant('decline')).toBe('danger');
    expect(creditPathVariant(null)).toBe('neutral');
  });
});
