import type { ApplicationStatus, CompanyStatus, ListingStatus } from '../types/domain';

/**
 * Semantic pill variants (Phase 1 §06). Each maps to a contrast-checked
 * ground/text/dot triple in `styles/ops/_pills.scss`.
 *
 *   neutral  — draft, completed, cancelled, waived, archived, inactive
 *   info     — waiting on Blox (under review, pending activation, due)
 *   progress — contract stage (signing required, contracts submitted)
 *   success  — active, paid, published, down payment submitted
 *   warning  — waiting on the customer (resubmission, down payment required)
 *   danger   — rejected, overdue, failed
 *   ink      — terminal state owned by Blox (sold)
 *   outline  — state lives elsewhere (partner processing, upcoming)
 */
export type OpsPillSemanticVariant =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger'
  | 'cancelled'
  | 'ink'
  | 'outline';

/** @deprecated legacy names; still styled, alias onto the semantic variants. */
export type OpsPillLegacyVariant =
  | 'active'
  | 'published'
  | 'paid'
  | 'approved'
  | 'pending'
  | 'draft'
  | 'rejected'
  | 'expired'
  | 'reserved'
  | 'sold';

export type OpsPillVariant = OpsPillSemanticVariant | OpsPillLegacyVariant;

/** Dashboard / list metric card accents — aligned with status pill semantics. */
export type OpsCardTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger' | 'cancelled' | 'brand';

/** Map an application status to a dashboard card tone. */
export function applicationCardTone(status: string): OpsCardTone {
  const variant = applicationOpsPillVariant(status);
  if (variant === 'info' || variant === 'progress' || variant === 'success' || variant === 'warning' || variant === 'danger' || variant === 'cancelled') {
    return variant;
  }
  return 'neutral';
}

export type MarketplacePillVariant = 'approved' | 'pending' | 'rejected' | 'action';

export const applicationStatusStyles: Record<
  ApplicationStatus,
  { bg: string; color: string }
> = {
  draft: { bg: 'var(--blox-status-neutral-bg)', color: 'var(--blox-status-neutral-ink)' },
  under_review: { bg: 'var(--blox-status-info-bg)', color: 'var(--blox-status-info-ink)' },
  resubmission_required: { bg: 'var(--blox-status-warning-bg)', color: 'var(--blox-status-warning-ink)' },
  contract_signing_required: { bg: 'var(--blox-status-progress-bg)', color: 'var(--blox-status-progress-ink)' },
  contracts_submitted: { bg: 'var(--blox-status-progress-bg)', color: 'var(--blox-status-progress-ink)' },
  contract_under_review: { bg: 'var(--blox-status-info-bg)', color: 'var(--blox-status-info-ink)' },
  down_payment_required: { bg: 'var(--blox-status-warning-bg)', color: 'var(--blox-status-warning-ink)' },
  down_payment_submitted: { bg: 'var(--blox-status-success-bg)', color: 'var(--blox-status-success-ink)' },
  pending_finance_activation: { bg: 'var(--blox-status-info-bg)', color: 'var(--blox-status-info-ink)' },
  partner_processing: { bg: 'var(--blox-status-info-bg)', color: 'var(--blox-status-info-ink)' },
  lpo_issued: { bg: 'var(--blox-status-progress-bg)', color: 'var(--blox-status-progress-ink)' },
  acquisition_pending: { bg: 'var(--blox-status-info-bg)', color: 'var(--blox-status-info-ink)' },
  active: { bg: 'var(--blox-status-success-bg)', color: 'var(--blox-status-success-ink)' },
  hardship: { bg: 'var(--blox-status-warning-bg)', color: 'var(--blox-status-warning-ink)' },
  repossession_in_progress: { bg: 'var(--blox-status-danger-bg)', color: 'var(--blox-status-danger-ink)' },
  total_loss: { bg: 'var(--blox-status-danger-bg)', color: 'var(--blox-status-danger-ink)' },
  completed: { bg: 'var(--blox-status-success-bg)', color: 'var(--blox-status-success-ink)' },
  rejected: { bg: 'var(--blox-status-danger-bg)', color: 'var(--blox-status-danger-ink)' },
  submission_cancelled: { bg: '#F3F0F4', color: '#6B4E71' },
};

export const listingStatusStyles: Record<ListingStatus, { bg: string; color: string }> = {
  draft: { bg: 'var(--blox-status-neutral-bg)', color: 'var(--blox-status-neutral-ink)' },
  published: { bg: 'var(--blox-status-success-bg)', color: 'var(--blox-status-success-ink)' },
  reserved: { bg: 'var(--blox-status-warning-bg)', color: 'var(--blox-status-warning-ink)' },
  sold: { bg: 'var(--blox-deep-green)', color: '#fff' },
  archived: { bg: 'var(--blox-status-neutral-bg)', color: 'var(--blox-status-neutral-ink)' },
};

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  under_review: 'Under review',
  resubmission_required: 'Resubmission required',
  contract_signing_required: 'Contract signing required',
  contracts_submitted: 'Contracts submitted',
  contract_under_review: 'Contract under review',
  down_payment_required: 'Down payment required',
  down_payment_submitted: 'Down payment submitted',
  pending_finance_activation: 'Pending activation',
  partner_processing: 'Sent to partner finance',
  lpo_issued: 'Purchase order issued',
  acquisition_pending: 'Awaiting delivery',
  active: 'Active',
  hardship: 'Hardship plan',
  repossession_in_progress: 'Asset recovery',
  total_loss: 'Total loss',
  completed: 'Completed',
  rejected: 'Rejected',
  submission_cancelled: 'Cancelled',
};

const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  reserved: 'Reserved',
  sold: 'Sold',
  archived: 'Archived',
};

const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

/** Canonical human-readable application status label. */
export function applicationStatusLabel(status: string | undefined | null): string {
  if (!status) return '—';
  return (
    APPLICATION_STATUS_LABELS[status as ApplicationStatus] ??
    status.replace(/_/g, ' ')
  );
}

/** Canonical human-readable listing status label. */
export function listingStatusLabel(status: string | undefined | null): string {
  if (!status) return '—';
  return LISTING_STATUS_LABELS[status as ListingStatus] ?? status.replace(/_/g, ' ');
}

/** Canonical human-readable company status label. */
export function companyStatusLabel(status: string | undefined | null): string {
  if (!status) return '—';
  return COMPANY_STATUS_LABELS[status as CompanyStatus] ?? status.replace(/_/g, ' ');
}

/** Ops portal pill variant for company statuses. */
export function companyOpsPillVariant(status: string | undefined | null): OpsPillVariant {
  if (status === 'active') return 'success';
  return 'neutral';
}

const APPLICATION_PILL_VARIANTS: Record<ApplicationStatus, OpsPillSemanticVariant> = {
  draft: 'neutral',
  under_review: 'info',
  resubmission_required: 'warning',
  contract_signing_required: 'progress',
  contracts_submitted: 'progress',
  contract_under_review: 'info',
  down_payment_required: 'warning',
  down_payment_submitted: 'success',
  pending_finance_activation: 'info',
  partner_processing: 'info',
  lpo_issued: 'progress',
  acquisition_pending: 'info',
  active: 'success',
  hardship: 'warning',
  repossession_in_progress: 'danger',
  total_loss: 'danger',
  completed: 'success',
  rejected: 'danger',
  submission_cancelled: 'cancelled',
};

/** Ops portal pill variant for financing application statuses (Phase 1 §06 mapping). */
export function applicationOpsPillVariant(status: string): OpsPillVariant {
  return APPLICATION_PILL_VARIANTS[status as ApplicationStatus] ?? 'neutral';
}

/** Marketplace customer-facing pill variant for application statuses. */
export function applicationMarketplacePillVariant(status: string): MarketplacePillVariant {
  if (status === 'active' || status === 'completed') return 'approved';
  if (status === 'rejected' || status === 'submission_cancelled') return 'rejected';
  if (status === 'resubmission_required' || status === 'draft') return 'action';
  return 'pending';
}

/** Ops portal pill variant for inventory listing statuses. */
export function listingOpsPillVariant(status: string): OpsPillVariant {
  if (status === 'published') return 'success';
  if (status === 'reserved') return 'warning';
  if (status === 'sold') return 'ink';
  return 'neutral'; // draft, archived
}

/**
 * Ops portal pill variant for installment schedule statuses. Accepts the raw
 * API status (`pending`, `overdue`, …) or a display status (`due`, `upcoming`).
 */
export function scheduleOpsPillVariant(status: string): OpsPillVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'partially_paid':
      return 'warning';
    case 'waived':
      return 'neutral';
    case 'upcoming':
      return 'outline';
    default:
      return 'info'; // pending, due, active, unpaid
  }
}

export type DealerQuoteStatus = 'active' | 'used' | 'expired' | 'revoked';

const QUOTE_STATUS_LABELS: Record<DealerQuoteStatus, string> = {
  active: 'Active',
  used: 'Used',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function quoteStatusLabel(status: string | undefined | null): string {
  if (!status) return '—';
  return QUOTE_STATUS_LABELS[status as DealerQuoteStatus] ?? status.replace(/_/g, ' ');
}

/** Ops portal pill variant for dealer price-link quotes. */
export function quoteOpsPillVariant(status: string): OpsPillVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'used':
      return 'info';
    case 'expired':
      return 'neutral';
    case 'revoked':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Ops portal pill variant for payment transaction statuses. */
export function transactionOpsPillVariant(status: string): OpsPillVariant {
  if (status === 'paid' || status === 'confirmed' || status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'declined') return 'danger';
  if (status === 'refunded' || status === 'cancelled') return 'neutral';
  return 'info'; // pending, pending_bank
}
