/**
 * Server-side credit assessment used at decision time (LOS FSD §1.5 approval
 * matrix, DBR001 caps and exception tiers, stress test). The customer-facing
 * calculator uses the same affordability maths; this layer adds who may
 * approve and whether the case must be referred or declined.
 */
import { assessAffordability, type AffordabilityInput, type AffordabilityResult } from './affordability';
import {
  PRODUCT_RULES,
  requiredApprovalAuthority,
  type ProductRuleViolation,
  type VehicleCategory,
} from './product-rules';

export type ApprovalAuthority = 'senior_manager' | 'head_of_credit' | 'above_matrix';

export type CreditDecisionPath = 'approve' | 'refer' | 'decline';

export type CreditAssessmentInput = {
  affordability: AffordabilityInput | null;
  financedAmount: number;
  vehicleCategory: VehicleCategory;
  ruleFlags?: ProductRuleViolation[] | null;
  /** Guarantor / co-applicant net monthly income, counted towards affordability when present. */
  guarantorMonthlyIncome?: number | null;
};

export type CreditAssessment = {
  affordability: AffordabilityResult | null;
  /** Same maths with the guarantor's income added; null when there is no guarantor. */
  affordabilityWithGuarantor: AffordabilityResult | null;
  approvalAuthority: ApprovalAuthority;
  path: CreditDecisionPath;
  /** Machine reasons the UI translates (`creditAssessment.reason.*`). */
  reasons: string[];
  ruleFlags: ProductRuleViolation[];
  assessedAt: string;
};

export function assessCredit(input: CreditAssessmentInput, now = new Date()): CreditAssessment {
  const affordability = input.affordability ? assessAffordability(input.affordability) : null;
  const guarantorIncome = Number(input.guarantorMonthlyIncome ?? 0);
  const affordabilityWithGuarantor =
    input.affordability && guarantorIncome > 0
      ? assessAffordability({
          ...input.affordability,
          monthlyIncome: Number(input.affordability.monthlyIncome) + guarantorIncome,
        })
      : null;
  const approvalAuthority = requiredApprovalAuthority(input.vehicleCategory, input.financedAmount);
  const ruleFlags = input.ruleFlags ?? [];
  const reasons: string[] = [];
  let path: CreditDecisionPath = 'approve';

  if (!affordability) {
    reasons.push('affordability_unknown');
    path = 'refer';
  } else {
    const effective = affordabilityWithGuarantor ?? affordability;
    if (affordability.status === 'above_hard_cap' && effective.status === 'above_hard_cap') {
      reasons.push('dbr_above_hard_cap');
      path = 'decline';
    } else if (effective.status !== 'within_cap') {
      reasons.push(`dbr_exception_tier_${effective.exceptionTier}`);
      path = 'refer';
    } else if (affordability.status !== 'within_cap' && affordabilityWithGuarantor) {
      reasons.push('within_cap_with_guarantor');
      path = 'refer';
    }
    if (effective.stressed && !effective.stressed.withinLimit) {
      reasons.push('stress_test_failed');
      if (path === 'approve') path = 'refer';
    }
  }

  if (ruleFlags.some((f) => f.severity === 'hard')) {
    reasons.push('hard_rule_violation');
    path = 'decline';
  } else if (ruleFlags.length) {
    reasons.push('soft_rule_flags');
    if (path === 'approve') path = 'refer';
  }

  if (approvalAuthority === 'above_matrix') {
    reasons.push('above_approval_matrix');
    if (path === 'approve') path = 'refer';
  }

  return {
    affordability,
    affordabilityWithGuarantor,
    approvalAuthority,
    path,
    reasons,
    ruleFlags,
    assessedAt: now.toISOString(),
  };
}

/**
 * Which ops roles may sign off each authority level.
 *
 * Finance officers sit beside credit officers: this platform grants them
 * credit-parity review decisions (approve, reject, resubmit, reopen) and the
 * `finance ↔ credit parity` regression lock depends on it. The ladder above
 * them is unchanged — larger tickets still escalate to the head of credit and
 * then beyond the matrix.
 */
export const APPROVAL_AUTHORITY_ROLES: Record<ApprovalAuthority, ReadonlyArray<string>> = {
  senior_manager: ['credit_officer', 'finance_officer', 'admin', 'super_admin'],
  head_of_credit: ['credit_officer', 'admin', 'super_admin'],
  above_matrix: ['credit_officer', 'admin', 'super_admin'],
};

export function roleMayApprove(role: string, authority: ApprovalAuthority): boolean {
  return APPROVAL_AUTHORITY_ROLES[authority].includes(role);
}

/** Highest DBR exception tier a role may approve without escalation (EXC001). */
export const MAX_EXCEPTION_TIER_BY_ROLE: Record<string, number> = {
  credit_officer: 3,
  // Credit parity: the same exception ceiling as a credit officer.
  finance_officer: 1,
  admin: 2,
  super_admin: 3,
};

export function roleMayApproveTier(role: string, tier: number): boolean {
  return (MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0) >= tier;
}

/** Credit officers and super admins may approve above the DBR hard cap with a logged override reason. */
export function roleMayOverrideHardCap(role: string): boolean {
  return role === 'credit_officer' || role === 'super_admin';
}

export const HARD_CAP_PERCENT = Math.round(PRODUCT_RULES.dbr.hardCap * 100);
