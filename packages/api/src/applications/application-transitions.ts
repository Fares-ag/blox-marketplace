import { ApplicationStatus, UserRole } from '@prisma/client';

export type TransitionActor = 'customer' | 'credit' | 'finance' | 'admin' | 'dealer';

type TransitionRule = {
  from: ApplicationStatus;
  to: ApplicationStatus;
  actors: TransitionActor[];
  reasonRequired?: boolean;
};

/**
 * Decision roles: credit and finance share every review edge (blox-vercel
 * FINANCE_OFFICER_ALLOWED ≡ CREDIT_OFFICER_ALLOWED minus `active`). Activation
 * (→ active) is never a generic transition — it is the dedicated
 * `activate()` endpoint, which refuses finance officers.
 */
const DECISION: TransitionActor[] = ['credit', 'finance', 'admin'];

/**
 * Status matrix — mirrors blox-vercel `application-status-transitions.ts` and
 * the DB trigger `enforce_application_status_transition()`, minus every edge
 * into `active` (see `activate()`), plus marketplace-specific edges
 * (`partner_processing`, the down-payment recovery loop).
 */
const RULES: TransitionRule[] = [
  // draft
  { from: 'draft', to: 'under_review', actors: ['admin', 'dealer'] },
  { from: 'draft', to: 'partner_processing', actors: ['admin', 'dealer'] },
  { from: 'draft', to: 'pending_finance_activation', actors: ['admin'] },
  { from: 'draft', to: 'rejected', actors: ['admin'], reasonRequired: true },
  { from: 'draft', to: 'submission_cancelled', actors: ['admin', 'dealer'] },

  // under_review — "Approve for Finance" is the spine edge (vercel step 2).
  { from: 'under_review', to: 'pending_finance_activation', actors: DECISION },
  { from: 'under_review', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
  { from: 'under_review', to: 'rejected', actors: DECISION, reasonRequired: true },
  { from: 'under_review', to: 'submission_cancelled', actors: DECISION, reasonRequired: true },

  // resubmission_required
  { from: 'resubmission_required', to: 'under_review', actors: [...DECISION, 'dealer'] },
  { from: 'resubmission_required', to: 'partner_processing', actors: ['admin', 'dealer'] },
  { from: 'resubmission_required', to: 'rejected', actors: DECISION, reasonRequired: true },
  { from: 'resubmission_required', to: 'submission_cancelled', actors: DECISION, reasonRequired: true },

  // contract_signing_required (customer uploads the signed contract → contracts_submitted)
  { from: 'contract_signing_required', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
  { from: 'contract_signing_required', to: 'rejected', actors: DECISION, reasonRequired: true },
  { from: 'contract_signing_required', to: 'under_review', actors: DECISION, reasonRequired: true },

  // contracts_submitted
  { from: 'contracts_submitted', to: 'contract_under_review', actors: DECISION },
  { from: 'contracts_submitted', to: 'pending_finance_activation', actors: DECISION },
  { from: 'contracts_submitted', to: 'contract_signing_required', actors: DECISION, reasonRequired: true },
  { from: 'contracts_submitted', to: 'resubmission_required', actors: DECISION, reasonRequired: true },
  { from: 'contracts_submitted', to: 'rejected', actors: DECISION, reasonRequired: true },

  // contract_under_review
  { from: 'contract_under_review', to: 'pending_finance_activation', actors: DECISION },
  { from: 'contract_under_review', to: 'contract_signing_required', actors: DECISION, reasonRequired: true },
  { from: 'contract_under_review', to: 'rejected', actors: DECISION, reasonRequired: true },
  // P0-6: down-payment collection path. The customer pays offline; ops records it.
  { from: 'contract_under_review', to: 'down_payment_required', actors: DECISION },

  // down_payment_required
  { from: 'down_payment_required', to: 'down_payment_submitted', actors: DECISION },
  { from: 'down_payment_required', to: 'pending_finance_activation', actors: DECISION },
  { from: 'down_payment_required', to: 'rejected', actors: DECISION, reasonRequired: true },

  // down_payment_submitted
  { from: 'down_payment_submitted', to: 'pending_finance_activation', actors: DECISION },
  { from: 'down_payment_submitted', to: 'down_payment_required', actors: DECISION, reasonRequired: true },
  { from: 'down_payment_submitted', to: 'rejected', actors: DECISION, reasonRequired: true },

  // pending_finance_activation — activation itself is `activate()` (credit/admin only).
  // Recovery when pending_finance_activation was reached before down payment was collected.
  { from: 'pending_finance_activation', to: 'down_payment_required', actors: DECISION },
  { from: 'pending_finance_activation', to: 'rejected', actors: DECISION, reasonRequired: true },
  { from: 'pending_finance_activation', to: 'under_review', actors: DECISION },
  { from: 'pending_finance_activation', to: 'submission_cancelled', actors: ['admin'], reasonRequired: true },

  // Partner path: frozen until an explicit exit (admin webhook/job) uses these edges.
  { from: 'partner_processing', to: 'under_review', actors: ['admin'] },
  { from: 'partner_processing', to: 'rejected', actors: ['admin'], reasonRequired: true },

  // LPO + acquisition (Blox-native path). Activation itself remains `activate()`.
  { from: 'pending_finance_activation', to: 'lpo_issued', actors: DECISION },
  { from: 'lpo_issued', to: 'acquisition_pending', actors: DECISION },
  { from: 'lpo_issued', to: 'pending_finance_activation', actors: DECISION, reasonRequired: true },
  { from: 'lpo_issued', to: 'rejected', actors: DECISION, reasonRequired: true },
  { from: 'acquisition_pending', to: 'lpo_issued', actors: DECISION, reasonRequired: true },
  { from: 'acquisition_pending', to: 'rejected', actors: DECISION, reasonRequired: true },

  // Servicing exits
  { from: 'active', to: 'hardship', actors: DECISION },
  { from: 'hardship', to: 'active', actors: DECISION },
  { from: 'hardship', to: 'repossession_in_progress', actors: DECISION },
  { from: 'hardship', to: 'completed', actors: ['admin'] },
  { from: 'repossession_in_progress', to: 'completed', actors: ['admin'] },
  { from: 'repossession_in_progress', to: 'hardship', actors: DECISION, reasonRequired: true },
  { from: 'active', to: 'total_loss', actors: DECISION },
  { from: 'hardship', to: 'total_loss', actors: DECISION },
  { from: 'total_loss', to: 'completed', actors: ['admin'] },

  // terminal / reopen
  { from: 'active', to: 'completed', actors: ['admin'] },
  { from: 'active', to: 'submission_cancelled', actors: ['admin'], reasonRequired: true },
  { from: 'rejected', to: 'under_review', actors: DECISION },
  { from: 'submission_cancelled', to: 'under_review', actors: ['admin'] },
];

/** Statuses from which `activate()` may move an application to `active`. */
export const ACTIVATE_FROM_STATUSES: ApplicationStatus[] = [
  'contracts_submitted',
  'contract_under_review',
  'down_payment_submitted',
  'pending_finance_activation',
  'acquisition_pending',
];

/** Admin / super_admin override: activate before any approval (vercel "Activate (Admin)" / "Activate draft"). */
export const ADMIN_ACTIVATE_FROM_STATUSES: ApplicationStatus[] = ['draft', 'under_review'];

/** Finance officer view-only activation queue (vercel FINANCE_ACTIVATION_QUEUE_STATUSES). */
export const FINANCE_ACTIVATION_QUEUE_STATUSES: ApplicationStatus[] = [
  'pending_finance_activation',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_submitted',
  'lpo_issued',
  'acquisition_pending',
];

/** Every ops edge for a given actor — handy for tests and for UI ⊆ API assertions. */
export function allowedTargets(from: ApplicationStatus, actor: TransitionActor): ApplicationStatus[] {
  return RULES.filter((r) => r.from === from && r.actors.includes(actor)).map((r) => r.to);
}

/** Statuses credit officers see in their queue (submitted pipeline). */
export const CREDIT_PIPELINE_STATUSES: ApplicationStatus[] = [
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

export const CREDIT_QUEUE_STATUSES: ApplicationStatus[] = [
  ...CREDIT_PIPELINE_STATUSES,
  'rejected',
];

export function roleToActor(role: UserRole): TransitionActor | null {
  if (role === UserRole.customer) return 'customer';
  if (role === UserRole.credit_officer) return 'credit';
  if (role === UserRole.finance_officer) return 'finance';
  if (role === UserRole.dealer_agent) return 'dealer';
  if (role === UserRole.admin || role === UserRole.super_admin || role === UserRole.group_admin) {
    return 'admin';
  }
  return null;
}

export function findTransitionRule(from: ApplicationStatus, to: ApplicationStatus): TransitionRule | undefined {
  return RULES.find((r) => r.from === from && r.to === to);
}

export function assertOpsTransitionAllowed(
  from: ApplicationStatus,
  to: ApplicationStatus,
  role: UserRole,
): void {
  const actor = roleToActor(role);
  if (!actor) throw new Error('forbidden_role');
  const rule = findTransitionRule(from, to);
  if (!rule || !rule.actors.includes(actor)) {
    throw new Error('invalid_status_transition');
  }
}

export function opsTransitionRequiresReason(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return findTransitionRule(from, to)?.reasonRequired === true;
}
