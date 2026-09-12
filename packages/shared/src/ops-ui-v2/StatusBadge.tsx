import {
  applicationOpsPillVariant,
  applicationStatusLabel,
  companyOpsPillVariant,
  companyStatusLabel,
  listingOpsPillVariant,
  listingStatusLabel,
  quoteOpsPillVariant,
  quoteStatusLabel,
  scheduleOpsPillVariant,
} from '../config/status-styles';

/** Unified status pill — uses status-styles.ts for colors (teal-mapped vercel parity). */
export function StatusBadge({
  status,
  type = 'application',
  label,
}: {
  status?: string | null;
  type?: 'application' | 'schedule' | 'listing' | 'company' | 'quote';
  label?: string;
}) {
  const safeStatus = status ?? '';
  const resolvedLabel =
    label ??
    (type === 'application'
      ? applicationStatusLabel(safeStatus)
      : type === 'listing'
        ? listingStatusLabel(safeStatus)
        : type === 'quote'
          ? quoteStatusLabel(safeStatus)
          : type === 'company'
            ? companyStatusLabel(safeStatus)
            : safeStatus.replace(/_/g, ' ') || '—');

  const variant =
    type === 'application'
      ? applicationOpsPillVariant(safeStatus)
      : type === 'listing'
        ? listingOpsPillVariant(safeStatus)
        : type === 'quote'
          ? quoteOpsPillVariant(safeStatus)
          : type === 'company'
            ? companyOpsPillVariant(safeStatus)
            : scheduleOpsPillVariant(safeStatus);

  return <span className={`blox-pill blox-pill--${variant}`}>{resolvedLabel}</span>;
}
