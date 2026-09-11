import type { ApplicationStatus } from '../types/domain';

/**
 * Single source of truth for application status vocabulary.
 *
 * `ApplicationStatus` is the ops/legal state stored in Postgres.
 * `CustomerPhase` is a derived UI stepper aligned with the Master
 * Diminishing Musharakah diagram — never stored as a fake enum value.
 *
 * Phantom mobile statuses (`approved`, `pre_disbursal_pending`) must be
 * mapped here rather than added to Prisma.
 */

export const CUSTOMER_PHASES = [
  'apply',
  'vetting',
  'contract',
  'pre_disbursal',
  'lpo',
  'acquisition',
  'rental',
  'exit',
] as const;

export type CustomerPhase = (typeof CUSTOMER_PHASES)[number];

/** Diagram-aligned customer stepper. Terminal / negative outcomes return `exit`. */
export function customerPhaseFor(status: string | null | undefined): CustomerPhase {
  switch (status) {
    case 'draft':
      return 'apply';
    case 'under_review':
    case 'resubmission_required':
    case 'partner_processing':
      return 'vetting';
    case 'contract_signing_required':
    case 'contracts_submitted':
    case 'contract_under_review':
      return 'contract';
    case 'down_payment_required':
    case 'down_payment_submitted':
    case 'pending_finance_activation':
      return 'pre_disbursal';
    case 'lpo_issued':
      return 'lpo';
    case 'acquisition_pending':
      return 'acquisition';
    case 'active':
    case 'hardship':
      return 'rental';
    case 'completed':
    case 'rejected':
    case 'submission_cancelled':
    case 'repossession_in_progress':
    case 'total_loss':
      return 'exit';
    default:
      return 'apply';
  }
}

/** Map invented Flutter / fixture statuses onto the canonical API enum. */
export function canonicalStatusFromLegacy(status: string | null | undefined): ApplicationStatus | null {
  if (!status) return null;
  if (status === 'approved') return 'contract_signing_required';
  if (status === 'pre_disbursal_pending') return 'down_payment_required';
  if (status === 'cancelled') return 'submission_cancelled';
  return null;
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'partner_processing',
  'lpo_issued',
  'acquisition_pending',
  'active',
  'hardship',
  'repossession_in_progress',
  'total_loss',
  'completed',
  'rejected',
  'submission_cancelled',
];

export const BLOCKING_APPLICATION_STATUSES: ApplicationStatus[] = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'partner_processing',
  'lpo_issued',
  'acquisition_pending',
  'active',
  'hardship',
  'repossession_in_progress',
  'total_loss',
];

export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'completed',
  'rejected',
  'submission_cancelled',
];

/** Partner-path apps stay frozen until an explicit exit job/webhook uses these edges. */
export const PARTNER_PROCESSING_EXIT_STATUSES: ApplicationStatus[] = ['under_review', 'rejected'];

export const LPO_GATE_ACTIVATE_FROM: ApplicationStatus[] = ['acquisition_pending'];

export const LEGACY_ACTIVATE_FROM: ApplicationStatus[] = [
  'contracts_submitted',
  'contract_under_review',
  'down_payment_submitted',
  'pending_finance_activation',
];
