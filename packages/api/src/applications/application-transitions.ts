import { ApplicationStatus, UserRole } from '@prisma/client';

export type TransitionActor = 'customer' | 'credit' | 'finance' | 'admin' | 'dealer';

type TransitionRule = {
  from: ApplicationStatus;
  to: ApplicationStatus;
  actors: TransitionActor[];
  reasonRequired?: boolean;
};

/** Authoritative subset for Phase 2 happy path + existing Phase 1 edges. */
const RULES: TransitionRule[] = [
  { from: 'draft', to: 'under_review', actors: ['admin', 'dealer'] },
  { from: 'draft', to: 'partner_processing', actors: ['admin', 'dealer'] },
  { from: 'resubmission_required', to: 'partner_processing', actors: ['admin', 'dealer'] },
  { from: 'draft', to: 'rejected', actors: ['admin'], reasonRequired: true },
  { from: 'draft', to: 'submission_cancelled', actors: ['admin', 'dealer'] },
  { from: 'under_review', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'under_review', to: 'resubmission_required', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'resubmission_required', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'resubmission_required', to: 'under_review', actors: ['credit', 'admin', 'dealer'] },
  { from: 'contract_signing_required', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'contracts_submitted', to: 'contract_under_review', actors: ['credit', 'admin'] },
  { from: 'contracts_submitted', to: 'contract_signing_required', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'contracts_submitted', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'contract_under_review', to: 'pending_finance_activation', actors: ['credit', 'admin'] },
  { from: 'contract_under_review', to: 'contract_signing_required', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'contract_under_review', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  // P0-6: down-payment collection path. Optional — the direct
  // contract_under_review → pending_finance_activation edge above remains valid
  // for offers with no down payment. The customer pays offline; ops records it.
  { from: 'contract_under_review', to: 'down_payment_required', actors: ['credit', 'admin'] },
  { from: 'down_payment_required', to: 'down_payment_submitted', actors: ['credit', 'admin'] },
  { from: 'down_payment_required', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'down_payment_submitted', to: 'pending_finance_activation', actors: ['credit', 'finance', 'admin'] },
  { from: 'down_payment_submitted', to: 'down_payment_required', actors: ['credit', 'finance', 'admin'], reasonRequired: true },
  { from: 'rejected', to: 'under_review', actors: ['credit', 'admin'] },
  { from: 'active', to: 'completed', actors: ['admin'] },
];

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
