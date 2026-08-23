import React from 'react';
import { Chip } from '@mui/material';
import './StatusBadge.scss';
import { getStatusColor } from '../../utils/formatters';

export interface StatusBadgeProps {
  status: string;
  type?: 'application' | 'payment';
}

const BRAND_FILL_STATUS_VARS = new Set([
  'var(--status-due)',
  'var(--status-active)',
  'var(--status-under-review)',
]);

const isBrandFill = (bgColor: string): boolean => {
  if (BRAND_FILL_STATUS_VARS.has(bgColor)) return true;
  const normalized = bgColor.toLowerCase();
  return normalized.includes('00cfa2') || normalized.includes('00b890');
};

export const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ status, type = 'application' }) => {
  const getColor = () => {
    if (type === 'payment') {
      const paymentStatuses: Record<string, string> = {
        due: 'var(--status-due)',
        active: 'var(--status-active)',
        paid: 'var(--status-paid)',
        unpaid: 'var(--status-unpaid)',
        partially_paid: 'var(--status-partially-paid)',
        upcoming: 'var(--status-active)',
      };
      return paymentStatuses[status.toLowerCase()] || 'var(--custom-text-color)';
    }
    return getStatusColor(status);
  };

  const formattedStatus = status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const backgroundColor = getColor();
  const brandFill = isBrandFill(backgroundColor);

  const getTextColor = (bgColor: string): string => {
    if (brandFill) {
      return 'var(--blox-black)';
    }
    if (bgColor.startsWith('var(--')) {
      return '#FFFFFF';
    }
    if (bgColor.includes('FFC107') || bgColor.includes('FF9800')) {
      return 'var(--blox-black)';
    }
    if (
      bgColor.includes('2196F3') ||
      bgColor.includes('4CAF50') ||
      bgColor.includes('9C27B0') ||
      bgColor.includes('F44336') ||
      bgColor.includes('757575')
    ) {
      return '#FFFFFF';
    }
    if (bgColor.includes('787663') || bgColor.includes('C9C4B7')) {
      return '#FFFFFF';
    }
    return '#FFFFFF';
  };

  return (
    <Chip
      label={formattedStatus}
      className="status-badge"
      sx={{
        backgroundColor: backgroundColor,
        color: getTextColor(backgroundColor),
        fontWeight: 600,
        fontSize: '13px',
        height: '26px',
        px: 1,
        border: brandFill ? '1px solid var(--blox-black)' : '1px solid transparent',
      }}
    />
  );
});
