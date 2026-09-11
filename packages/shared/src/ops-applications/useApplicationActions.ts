import type { ApplicationStatus, UserRole } from '../types/domain';

/**
 * Role × status → visible workspace actions.
 *
 * Mirrors blox-vercel `ApplicationDetailPage` gating:
 *   canCreditDecide       = credit | finance | admin   (review decisions)
 *   canActivateFinancing  = credit | admin             (→ active; finance never)
 *   canMarkPaid           = credit | finance | admin
 * Every edge listed here must exist in the API's `application-transitions.ts`
 * RULES for the same actor — `ui-actions-match-rules.spec.ts` enforces that.
 */

export function isFullAdminRole(role?: UserRole | null) {
  return role === 'admin' || role === 'super_admin';
}

/** Review decisions: finance has credit parity (blox-vercel FINANCE_PORTAL.md). */
export function canCreditDecide(role?: UserRole | null) {
  return role === 'credit_officer' || role === 'finance_officer' || isFullAdminRole(role);
}

/** Money ops surfaces (settlements, credits, bank transfers): finance/admin. */
export function canFinanceAct(role?: UserRole | null) {
  return role === 'finance_officer' || isFullAdminRole(role);
}

/** Activation is credit/admin only — finance views the activation queue. */
export function canActivateFinancing(role?: UserRole | null) {
  return role === 'credit_officer' || isFullAdminRole(role);
}

/** Mark-paid is shared by credit, finance and admin. */
export function canMarkPaid(role?: UserRole | null) {
  return role === 'credit_officer' || role === 'finance_officer' || isFullAdminRole(role);
}

const REJECTABLE: ApplicationStatus[] = [
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'lpo_issued',
  'acquisition_pending',
];

const RESUBMITTABLE: ApplicationStatus[] = [
  'under_review',
  'contract_signing_required',
  'contracts_submitted',
];

/** Credit/admin "Activate Financing" entry points (vercel handoff states). */
export const ACTIVATE_FROM_STATUSES: ApplicationStatus[] = [
  'contracts_submitted',
  'contract_under_review',
  'down_payment_submitted',
  'pending_finance_activation',
  'acquisition_pending',
];

/** Admin-only override before approval (vercel "Activate (Admin)" / "Activate draft"). */
export const ADMIN_ACTIVATE_FROM_STATUSES: ApplicationStatus[] = ['draft', 'under_review'];

export function visibleWorkspaceActions(status: ApplicationStatus, role?: UserRole | null) {
  const dealer = role === 'dealer_agent';
  const admin = isFullAdminRole(role);
  const decide = canCreditDecide(role);
  const activator = canActivateFinancing(role);
  const finance = canFinanceAct(role);
  return {
    // dealer / admin intake
    submitToCredit: (dealer || admin) && (status === 'draft' || status === 'resubmission_required'),

    // review decisions (credit ≡ finance ≡ admin)
    approveContract: decide && status === 'under_review',
    approveForFinance: decide && status === 'under_review',
    reject: decide && REJECTABLE.includes(status),
    requestResubmission: decide && RESUBMITTABLE.includes(status),
    startContractReview: decide && status === 'contracts_submitted',
    approveSignedContract: decide && (status === 'contracts_submitted' || status === 'contract_under_review'),
    requireDownPayment: decide && status === 'contract_under_review',
    recoverDownPayment: decide && status === 'pending_finance_activation',
    recordDownPayment: decide && (status === 'down_payment_required' || status === 'down_payment_submitted'),
    issueLpo: finance && status === 'pending_finance_activation',
    confirmLpoSettlement: finance && status === 'lpo_issued',
    openHardship: decide && status === 'active',
    resolveHardship: decide && status === 'hardship',
    startRepossession: decide && status === 'hardship',
    fileTotalLoss: decide && status === 'active',
    reopen: decide && (status === 'rejected' || (admin && status === 'submission_cancelled')),
    cancel:
      (decide && (status === 'under_review' || status === 'resubmission_required')) ||
      (admin && (status === 'pending_finance_activation' || status === 'active')),
    complianceCheck: decide,
    uploadSignedContract: decide && status === 'contract_signing_required',

    // activation (credit / admin only)
    activate: activator && ACTIVATE_FROM_STATUSES.includes(status),
    directActivate: activator && status === 'under_review',
    activateAdmin: admin && ADMIN_ACTIVATE_FROM_STATUSES.includes(status),

    // money ops
    markInstallmentPaid: canMarkPaid(role) && status === 'active',
    waiveSchedule: admin && status === 'active',
    settlements: finance,

    // shared
    comment: decide || dealer,
    uploadDocs:
      (dealer || decide) &&
      ['draft', 'under_review', 'resubmission_required', 'contract_signing_required'].includes(status),

    // admin config
    edit: admin,
    deleteApp: admin && ['draft', 'rejected', 'submission_cancelled'].includes(status),
    assignCompany: admin,
    editInstallments: admin,
    convertDaily: admin && status === 'active',
  };
}

export type WorkspaceActions = ReturnType<typeof visibleWorkspaceActions>;
