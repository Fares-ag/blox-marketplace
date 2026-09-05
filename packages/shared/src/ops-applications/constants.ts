import type { ApplicationStatus } from '../types/domain';

/**
 * Queue status sets — mirror blox-vercel `application-status-transitions.ts`
 * and the API's `application-transitions.ts`. Keep the two in step.
 */
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

export const CREDIT_QUEUE_STATUSES: ApplicationStatus[] = [...CREDIT_PIPELINE_STATUSES, 'rejected'];

/** Finance "Activation" tab — view-only handoff states; Activate lives on the credit portal. */
export const FINANCE_ACTIVATION_QUEUE_STATUSES: ApplicationStatus[] = [
  'pending_finance_activation',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_submitted',
];

/** Finance "Review" tab — same pipeline as credit so finance can decide before activation. */
export const FINANCE_REVIEW_QUEUE_STATUSES: ApplicationStatus[] = [...CREDIT_PIPELINE_STATUSES, 'rejected'];

/** Finance operational book. */
export const FINANCE_ACTIVE_BOOK_STATUSES: ApplicationStatus[] = ['active'];
