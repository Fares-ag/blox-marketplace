import { formatQar } from '../../lib/format';

export const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') {
    return '';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;

  if (Number.isNaN(numAmount)) {
    return '';
  }

  return formatQar(numAmount, true);
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--status-draft)',
  active: 'var(--status-active)',
  completed: 'var(--status-completed)',
  'under review': 'var(--status-under-review)',
  rejected: 'var(--status-rejected)',
  'contract signing required': 'var(--status-contract-signing)',
  'resubmission required': 'var(--status-under-review)',
  'contracts submitted': 'var(--status-under-review)',
  'contract under review': 'var(--status-under-review)',
  'down payment required': 'var(--status-due)',
  'down payment submitted': 'var(--status-paid)',
  'submission cancelled': 'var(--status-partially-paid)',
  'pending finance activation': 'var(--status-under-review)',
  'partner processing': 'var(--status-under-review)',
};

export const getStatusColor = (status: string): string => {
  const normalizedStatus = status.replace(/_/g, ' ').toLowerCase().trim();
  return STATUS_COLORS[normalizedStatus] || 'var(--status-draft)';
};
