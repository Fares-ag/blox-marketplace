import type { ApplicationStatus } from '../types/domain';

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
