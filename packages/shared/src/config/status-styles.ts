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

export type MarketplacePillVariant = 'approved' | 'pending' | 'rejected' | 'action';

export const applicationStatusStyles: Record<
  ApplicationStatus,
  { bg: string; color: string }
> = {
  draft: { bg: 'var(--dm-surface-muted)', color: 'var(--dm-slate-600)' },
  under_review: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-steel)' },
  resubmission_required: { bg: 'var(--dm-warning-soft)', color: 'var(--dm-warning)' },
  contract_signing_required: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-graphite-800)' },
  contracts_submitted: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-graphite-800)' },
  contract_under_review: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-steel)' },
  down_payment_required: { bg: 'var(--dm-warning-soft)', color: 'var(--dm-warning)' },
  down_payment_submitted: { bg: 'var(--dm-success-soft)', color: 'var(--dm-success)' },
  pending_finance_activation: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-steel)' },
  partner_processing: { bg: 'var(--dm-steel-soft)', color: 'var(--dm-steel)' },
  active: { bg: 'var(--dm-success-soft)', color: 'var(--dm-success)' },
  completed: { bg: 'var(--dm-surface-muted)', color: 'var(--dm-slate-600)' },
  rejected: { bg: 'var(--dm-danger-soft)', color: 'var(--dm-danger)' },
  submission_cancelled: { bg: 'var(--dm-surface-muted)', color: 'var(--dm-slate-600)' },
};

export const listingStatusStyles: Record<ListingStatus, { bg: string; color: string }> = {
  draft: { bg: 'var(--dm-surface-muted)', color: 'var(--dm-slate-600)' },
  published: { bg: 'var(--dm-success-soft)', color: 'var(--dm-success)' },
  reserved: { bg: 'var(--dm-warning-soft)', color: 'var(--dm-warning)' },
  sold: { bg: 'var(--dm-slate-200)', color: 'var(--dm-ink)' },
  archived: { bg: 'var(--dm-surface-muted)', color: 'var(--dm-slate-600)' },
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
  active: 'Active',
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
  partner_processing: 'outline',
  active: 'success',
  completed: 'neutral',
  rejected: 'danger',
  submission_cancelled: 'neutral',
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

/** Ops portal pill variant for payment transaction statuses. */
export function transactionOpsPillVariant(status: string): OpsPillVariant {
  if (status === 'paid' || status === 'confirmed' || status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'declined') return 'danger';
  if (status === 'refunded' || status === 'cancelled') return 'neutral';
  return 'info'; // pending, pending_bank
}
