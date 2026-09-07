import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assessCredit, type CreditAssessment } from '@drivemarket/shared/domain-rules';
import {
  assertApprovalAuthorized,
  declinedForHardCap,
  effectiveAffordability,
  evaluateApprovalAuthorization,
} from './credit-decision';

/**
 * Expat, private (unlisted) employer → DBR cap 0.50, hard cap 0.75, exception
 * tiers at +0.03 / +0.05. Income 10,000 with no liabilities, so the installment
 * sets the DBR directly. Financed amounts pick the authority level (car: ≤50k
 * senior manager, ≤70k head of credit, above → outside the matrix).
 */
function assessment(opts: {
  installment: number;
  financed?: number;
  guarantorIncome?: number | null;
  income?: number | null;
}): CreditAssessment {
  return assessCredit({
    affordability:
      opts.income === null
        ? null
        : {
            monthlyIncome: opts.income ?? 10_000,
            monthlyLiabilities: 0,
            proposedInstallment: opts.installment,
            residency: 'expat',
            employerCategory: 'private_unlisted',
            financedAmount: opts.financed ?? 30_000,
          },
    financedAmount: opts.financed ?? 30_000,
    vehicleCategory: 'car',
    guarantorMonthlyIncome: opts.guarantorIncome ?? null,
  });
}

const WITHIN_CAP = assessment({ installment: 4_000 }); // 0.40
const TIER_1 = assessment({ installment: 5_200 }); // 0.52 → +0.02
const TIER_2 = assessment({ installment: 5_450 }); // 0.545 → +0.045
const TIER_3 = assessment({ installment: 6_000 }); // 0.60 → +0.10, still under the hard cap
const ABOVE_HARD_CAP = assessment({ installment: 8_000 }); // 0.80
const HEAD_OF_CREDIT = assessment({ installment: 4_000, financed: 60_000 });
const ABOVE_MATRIX = assessment({ installment: 4_000, financed: 90_000 });

describe('approval matrix fixtures', () => {
  it('build the tiers the matrix is tested against', () => {
    expect(WITHIN_CAP.affordability?.exceptionTier).toBe(0);
    expect(TIER_1.affordability?.exceptionTier).toBe(1);
    expect(TIER_2.affordability?.exceptionTier).toBe(2);
    expect(TIER_3.affordability?.status).toBe('exception_tier_3');
    expect(ABOVE_HARD_CAP.affordability?.status).toBe('above_hard_cap');
    expect(ABOVE_HARD_CAP.path).toBe('decline');
    expect(HEAD_OF_CREDIT.approvalAuthority).toBe('head_of_credit');
    expect(ABOVE_MATRIX.approvalAuthority).toBe('above_matrix');
  });
});

describe('evaluateApprovalAuthorization — approval authority', () => {
  it.each([
    ['credit_officer', WITHIN_CAP, true],
    ['admin', WITHIN_CAP, true],
    ['super_admin', WITHIN_CAP, true],
    ['finance_officer', WITHIN_CAP, false],
    ['credit_officer', HEAD_OF_CREDIT, false],
    ['admin', HEAD_OF_CREDIT, true],
    ['super_admin', HEAD_OF_CREDIT, true],
    ['credit_officer', ABOVE_MATRIX, false],
    ['admin', ABOVE_MATRIX, false],
    ['super_admin', ABOVE_MATRIX, true],
  ])('%s on %O.approvalAuthority → allowed %s', (role, credit, allowed) => {
    const outcome = evaluateApprovalAuthorization({ role, assessment: credit });
    expect(outcome.ok).toBe(allowed);
    if (!outcome.ok) {
      expect(outcome).toMatchObject({ status: 403, code: 'approval_authority_required' });
      expect(outcome.extras.authority).toBe(credit.approvalAuthority);
      expect(outcome.extras.required_roles).toContain('super_admin');
    }
  });
});

describe('evaluateApprovalAuthorization — DBR exception tiers', () => {
  it.each([
    ['credit_officer', TIER_1, true],
    ['credit_officer', TIER_2, false],
    ['credit_officer', TIER_3, false],
    ['admin', TIER_2, true],
    ['admin', TIER_3, false],
    ['super_admin', TIER_3, true],
  ])('%s on tier %O → allowed %s', (role, credit, allowed) => {
    const outcome = evaluateApprovalAuthorization({ role, assessment: credit });
    expect(outcome.ok).toBe(allowed);
    if (outcome.ok) {
      expect(outcome.tier).toBe(credit.affordability?.exceptionTier);
      expect(outcome.overridden).toBe(false);
    } else {
      expect(outcome).toEqual({
        ok: false,
        status: 403,
        code: 'dbr_exception_escalation_required',
        extras: { tier: credit.affordability?.exceptionTier },
      });
    }
  });

  it('judges the tier with the guarantor income when there is one', () => {
    const rescued = assessment({ installment: 6_000, guarantorIncome: 6_000 }); // 6,000 / 16,000 = 0.375
    expect(rescued.affordabilityWithGuarantor?.status).toBe('within_cap');
    expect(effectiveAffordability(rescued)).toBe(rescued.affordabilityWithGuarantor);
    expect(evaluateApprovalAuthorization({ role: 'credit_officer', assessment: rescued })).toMatchObject({
      ok: true,
      tier: 0,
    });
  });

  it('lets an unknown affordability through the tier check (it is referred, not tiered)', () => {
    const unknown = assessment({ installment: 4_000, income: null });
    expect(unknown.affordability).toBeNull();
    expect(evaluateApprovalAuthorization({ role: 'credit_officer', assessment: unknown })).toMatchObject({ ok: true, tier: 0 });
  });
});

describe('evaluateApprovalAuthorization — hard cap', () => {
  it('escalates a hard-cap case from credit and admin before the override question arises', () => {
    expect(evaluateApprovalAuthorization({ role: 'credit_officer', assessment: ABOVE_HARD_CAP })).toMatchObject({
      ok: false,
      code: 'dbr_exception_escalation_required',
      extras: { tier: 3 },
    });
    expect(
      evaluateApprovalAuthorization({ role: 'admin', assessment: ABOVE_HARD_CAP, overrideReason: 'board exception' }),
    ).toMatchObject({ ok: false, code: 'dbr_exception_escalation_required' });
  });

  it('refuses a super admin without an override reason and records the override with one', () => {
    expect(declinedForHardCap(ABOVE_HARD_CAP)).toBe(true);
    expect(declinedForHardCap(TIER_3)).toBe(false);
    expect(evaluateApprovalAuthorization({ role: 'super_admin', assessment: ABOVE_HARD_CAP })).toEqual({
      ok: false,
      status: 409,
      code: 'dbr_above_hard_cap',
      extras: { tier: 3 },
    });
    expect(
      evaluateApprovalAuthorization({ role: 'super_admin', assessment: ABOVE_HARD_CAP, overrideReason: '   ' }),
    ).toMatchObject({ ok: false, code: 'dbr_above_hard_cap' });
    expect(
      evaluateApprovalAuthorization({
        role: 'super_admin',
        assessment: ABOVE_HARD_CAP,
        overrideReason: 'Board-approved exception, collateral covers the exposure',
      }),
    ).toEqual({ ok: true, overridden: true, authority: 'senior_manager', tier: 3 });
  });
});

describe('assertApprovalAuthorized', () => {
  it('throws 403 with the required roles and authority', () => {
    try {
      assertApprovalAuthorized({ role: 'credit_officer', assessment: HEAD_OF_CREDIT });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        message: 'approval_authority_required',
        required_roles: ['admin', 'super_admin'],
        authority: 'head_of_credit',
      });
    }
  });

  it('throws 403 with the tier for an escalation', () => {
    try {
      assertApprovalAuthorized({ role: 'credit_officer', assessment: TIER_2 });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        message: 'dbr_exception_escalation_required',
        tier: 2,
      });
    }
  });

  it('throws 409 above the hard cap and returns the outcome when the officer may approve', () => {
    expect(() => assertApprovalAuthorized({ role: 'super_admin', assessment: ABOVE_HARD_CAP })).toThrow(ConflictException);
    expect(assertApprovalAuthorized({ role: 'credit_officer', assessment: WITHIN_CAP })).toEqual({
      ok: true,
      overridden: false,
      authority: 'senior_manager',
      tier: 0,
    });
  });
});
