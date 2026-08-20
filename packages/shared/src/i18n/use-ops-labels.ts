import { useTranslation } from 'react-i18next';

/** Shared label helpers for ops portals — re-renders when locale changes. */
export function useOpsLabels() {
  const { t } = useTranslation();
  return {
    t,
    applicationStatus: (status: string) =>
      t(`ops.status.${status}`, { defaultValue: status.replace(/_/g, ' ') }),
    listingStatus: (status: string) =>
      t(`ops.listingStatus.${status}`, { defaultValue: status.replace(/_/g, ' ') }),
    scheduleStatus: (status: string) =>
      t(`ops.scheduleStatus.${status}`, { defaultValue: status.replace(/_/g, ' ') }),
    pagination: (from: number, to: number, total: number) =>
      t('ops.pagination.showing', { from, to, total }),
  };
}
