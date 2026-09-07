import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  APPROVAL_AUTHORITY_ROLES,
  roleMayApprove,
  roleMayApproveTier,
  type ApprovalAuthority,
  type CreditAssessment,
} from '@drivemarket/shared/domain-rules';

/**
 * Who may approve an application out of review (LOS FSD §1.5 approval matrix,
 * EXC001 DBR exception tiers, §9.2 hard cap):
 *
 *   1. the approval authority the financed amount needs must be within the
 *      officer's role                      → 403 `approval_authority_required`
 *   2. a DBR exception tier above what the role may sign off must be escalated
 *                                          → 403 `dbr_exception_escalation_required`
 *   3. a case the matrix declines for the hard cap can only be approved by a
 *      super administrator giving an override reason
 *                                          → 409 `dbr_above_hard_cap`
 *
 * Pure so the matrix is unit-tested without a database.
 */

export type ApprovalDecisionInput = {
  role: string;
  assessment: CreditAssessment;
  /** Super-admin justification for approving above the hard cap (logged as `credit_override`). */
  overrideReason?: string | null;
};

export type ApprovalDecisionOutcome =
  | { ok: true; overridden: boolean; authority: ApprovalAuthority; tier: number }
  | {
      ok: false;
      status: 403 | 409;
      code: 'approval_authority_required' | 'dbr_exception_escalation_required' | 'dbr_above_hard_cap';
      extras: Record<string, unknown>;
    };

/** The affordability that drives the decision: with the guarantor's income when there is one. */
export function effectiveAffordability(assessment: CreditAssessment) {
  return assessment.affordabilityWithGuarantor ?? assessment.affordability;
}

export function declinedForHardCap(assessment: CreditAssessment): boolean {
  return assessment.path === 'decline' && assessment.reasons.includes('dbr_above_hard_cap');
}

export function evaluateApprovalAuthorization(input: ApprovalDecisionInput): ApprovalDecisionOutcome {
  const { role, assessment } = input;
  const authority = assessment.approvalAuthority;
  if (!roleMayApprove(role, authority)) {
    return {
      ok: false,
      status: 403,
      code: 'approval_authority_required',
      extras: { required_roles: [...APPROVAL_AUTHORITY_ROLES[authority]], authority },
    };
  }

  const tier = effectiveAffordability(assessment)?.exceptionTier ?? 0;
  if (tier > 0 && !roleMayApproveTier(role, tier)) {
    return { ok: false, status: 403, code: 'dbr_exception_escalation_required', extras: { tier } };
  }

  let overridden = false;
  if (declinedForHardCap(assessment)) {
    const reason = input.overrideReason?.trim();
    if (role !== 'super_admin' || !reason) {
      return { ok: false, status: 409, code: 'dbr_above_hard_cap', extras: { tier } };
    }
    overridden = true;
  }

  return { ok: true, overridden, authority, tier };
}

/** Throws the matching Nest exception; returns the outcome when the officer may approve. */
export function assertApprovalAuthorized(input: ApprovalDecisionInput): Extract<ApprovalDecisionOutcome, { ok: true }> {
  const outcome = evaluateApprovalAuthorization(input);
  if (outcome.ok) return outcome;
  const payload = { message: outcome.code, ...outcome.extras };
  if (outcome.status === 409) throw new ConflictException(payload);
  throw new ForbiddenException(payload);
}
