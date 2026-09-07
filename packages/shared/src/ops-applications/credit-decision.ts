/**
 * Credit decisioning on the ops side (LOS FSD §1.5 approval matrix, DBR001
 * exception tiers): pure helpers behind the credit assessment panel and the
 * decision panel. The API enforces the same rules on the approval transition;
 * these functions only explain them before the officer clicks and map the
 * enforcement errors back to guidance.
 */
import type { OpsPillVariant } from '../config/status-styles';
import type { AffordabilityDto, CreditAssessmentDto } from '../types/customer-platform';
import type { IntakeTranslate } from './customer-info';
import { apiErrorCodeOf, apiErrorDetails } from './submit-gate';

export const DECISION_ERROR_CODES = [
  'approval_authority_required',
  'dbr_exception_escalation_required',
  'dbr_above_hard_cap',
] as const;

export type DecisionErrorCode = (typeof DECISION_ERROR_CODES)[number];

export function decisionErrorCode(error: unknown): DecisionErrorCode | null {
  const code = apiErrorCodeOf(error);
  return (DECISION_ERROR_CODES as readonly string[]).includes(code) ? (code as DecisionErrorCode) : null;
}

export function roleLabel(role: string, t: IntakeTranslate): string {
  return t(`dealerOps.creditAssessment.role.${role}`, { defaultValue: role.replace(/_/g, ' ') });
}

export function roleListLabel(roles: unknown, t: IntakeTranslate): string {
  if (!Array.isArray(roles)) return '';
  return roles.map((role) => roleLabel(String(role), t)).join(', ');
}

export function authorityLabel(authority: unknown, t: IntakeTranslate): string {
  const value = String(authority ?? '');
  if (!value) return '';
  return t(`dealerOps.creditAssessment.authorityLevel.${value}`, { defaultValue: value.replace(/_/g, ' ') });
}

/** Translated guidance for an approval-enforcement error, or null when the error is something else. */
export function decisionErrorMessage(error: unknown, t: IntakeTranslate): string | null {
  const code = decisionErrorCode(error);
  if (!code) return null;
  const details = apiErrorDetails(error);
  if (code === 'approval_authority_required') {
    return t('dealerOps.decision.approvalAuthorityRequired', {
      roles: roleListLabel(details.required_roles, t),
      authority: authorityLabel(details.authority, t),
    });
  }
  if (code === 'dbr_exception_escalation_required') {
    return t('dealerOps.decision.escalationRequired', { tier: details.tier ?? '' });
  }
  return t('dealerOps.decision.aboveHardCap');
}

/** The affordability the decision is judged on: with the guarantor's income when there is one. */
export function effectiveAffordability(assessment: CreditAssessmentDto | null | undefined): AffordabilityDto | null {
  if (!assessment) return null;
  return assessment.affordability_with_guarantor ?? assessment.affordability ?? null;
}

export function effectiveExceptionTier(assessment: CreditAssessmentDto | null | undefined): number {
  return effectiveAffordability(assessment)?.exception_tier ?? 0;
}

export type ApproveBlock = {
  code: 'hard_cap' | 'authority' | 'tier';
  message: string;
};

/**
 * Why the approval buttons are disabled for this officer, or null when they may
 * approve. Mirrors the API's order: hard cap (super-admin override only), then
 * the approval matrix, then the DBR exception tier the role may sign off.
 * Unknown assessment → null; the API still enforces.
 */
export function approveBlockReason(input: {
  assessment: CreditAssessmentDto | null | undefined;
  role: string | null | undefined;
  t: IntakeTranslate;
}): ApproveBlock | null {
  const { assessment, role, t } = input;
  if (!assessment) return null;
  const superAdmin = role === 'super_admin';
  if (assessment.path === 'decline' && assessment.reasons.includes('dbr_above_hard_cap') && !superAdmin) {
    return { code: 'hard_cap', message: t('dealerOps.decision.aboveHardCap') };
  }
  const approver = assessment.approver;
  if (approver && !approver.role_may_approve) {
    return {
      code: 'authority',
      message: t('dealerOps.decision.approvalAuthorityRequired', {
        roles: roleListLabel(approver.required_roles, t),
        authority: authorityLabel(assessment.approval_authority, t),
      }),
    };
  }
  const tier = effectiveExceptionTier(assessment);
  if (approver && tier > approver.max_tier_for_role && !superAdmin) {
    return { code: 'tier', message: t('dealerOps.decision.escalationRequired', { tier }) };
  }
  return null;
}

export type DbrTone = 'success' | 'warning' | 'danger';

export type DbrGaugeModel = {
  /** Debt burden as a percentage of income (rounded to one decimal; `Infinity` when income is zero). */
  dbrPct: number;
  capPct: number;
  hardCapPct: number;
  /** Bar fill on a 0–100 axis. */
  fillPct: number;
  capMarkerPct: number;
  hardCapMarkerPct: number;
  tone: DbrTone;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

export function affordabilityTone(status: AffordabilityDto['status']): DbrTone {
  if (status === 'within_cap') return 'success';
  if (status === 'above_hard_cap') return 'danger';
  return 'warning';
}

export function dbrGaugeModel(a: AffordabilityDto): DbrGaugeModel {
  const dbr = Number(a.dbr);
  const dbrPct = Number.isFinite(dbr) ? round1(dbr * 100) : Number.POSITIVE_INFINITY;
  const capPct = Math.round(Number(a.cap) * 100);
  const hardCapPct = Math.round(Number(a.hard_cap) * 100);
  return {
    dbrPct,
    capPct,
    hardCapPct,
    fillPct: clampPct(dbrPct),
    capMarkerPct: clampPct(capPct),
    hardCapMarkerPct: clampPct(hardCapPct),
    tone: affordabilityTone(a.status),
  };
}

export function affordabilityPillVariant(status: AffordabilityDto['status']): OpsPillVariant {
  return affordabilityTone(status);
}

export function creditPathVariant(path: CreditAssessmentDto['path'] | null | undefined): OpsPillVariant {
  if (path === 'approve') return 'success';
  if (path === 'refer') return 'warning';
  if (path === 'decline') return 'danger';
  return 'neutral';
}

/** Percentage string for a DBR ratio; "—" when it cannot be computed. */
export function formatDbrPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return String(round1(Number(value) * 100));
}
