import type { ApplicationStatus, ListingStatus } from '../types/domain';

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
