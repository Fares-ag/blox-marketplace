/** Sum selected application status counts from an ops metrics map. */
export function sumStatuses(status: Record<string, number> | undefined, keys: readonly string[]): number {
  if (!status) return 0;
  return keys.reduce((sum, key) => sum + (status[key] ?? 0), 0);
}

export function totalStatuses(status: Record<string, number> | undefined): number {
  if (!status) return 0;
  return Object.values(status).reduce((sum, n) => sum + n, 0);
}

export const OPEN_APPLICATION_STATUSES = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
] as const;

export const CONTRACT_STAGE_STATUSES = [
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
] as const;

export const ACTIVE_FINANCING_STATUSES = [
  'active',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
] as const;

export const IN_REVIEW_METRIC_STATUSES = [
  'under_review',
  'resubmission_required',
  'contracts_submitted',
  'contract_under_review',
  'contract_signing_required',
] as const;
