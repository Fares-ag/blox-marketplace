import { ApplicationStatus, UserRole } from '@prisma/client';

export type TransitionActor = 'customer' | 'credit' | 'finance' | 'admin';

type TransitionRule = {
  from: ApplicationStatus;
  to: ApplicationStatus;
  actors: TransitionActor[];
  reasonRequired?: boolean;
};

/** Authoritative subset for Phase 2 happy path + existing Phase 1 edges. */
const RULES: TransitionRule[] = [
  { from: 'under_review', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'under_review', to: 'resubmission_required', actors: ['credit', 'admin'], reasonRequired: true },
  { from: 'resubmission_required', to: 'rejected', actors: ['credit', 'admin'], reasonRequired: true },
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
];

export function roleToActor(role: UserRole): TransitionActor | null {
  if (role === UserRole.customer) return 'customer';
  if (role === UserRole.credit_officer) return 'credit';
  if (role === UserRole.finance_officer) return 'finance';
  if (role === UserRole.admin || role === UserRole.super_admin) return 'admin';
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
