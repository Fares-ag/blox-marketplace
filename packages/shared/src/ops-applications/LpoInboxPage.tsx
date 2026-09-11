import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { OpsListPage, StatusBadge } from '../ops-ui-v2';
import { apiFetch } from '../lib/api';
import { formatQar } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';

type LpoRow = {
  id: string;
  application_id: string;
  status: string;
  amount: number;
  reference: string | null;
  issued_at: string;
  vehicle: string;
  application_status: string;
};

export function LpoInboxPage({
  detailBase = '/applications',
  titleKey = 'ops.dealer.nav.lpo',
}: {
  detailBase?: string;
  titleKey?: string;
}) {
  const { t } = useOpsLabels();
  const { data, isLoading } = useQuery({
    queryKey: ['ops-lpo'],
    queryFn: () => apiFetch<{ items: LpoRow[] }>('/api/ops/lpo'),
  });
  const items = data?.items ?? [];

  return (
    <OpsListPage title={t(titleKey)} subtitle={t('ops.dealer.applicationsSubtitle')}>
      {isLoading ? (
        <p>{t('ops.common.loading', { defaultValue: 'Loading…' })}</p>
      ) : items.length === 0 ? (
        <p>{t('ops.dealer.noOpenApps')}</p>
      ) : (
        <table className="blox-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('ops.credit.summary')}</th>
              <th>{t('ops.common.status', { defaultValue: 'Status' })}</th>
              <th>{t('ops.finance.nav.lpo')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={`${detailBase}/${row.application_id}`}>{row.reference ?? row.id.slice(0, 8)}</Link>
                </td>
                <td>{row.vehicle}</td>
                <td>
                  <StatusBadge status={row.application_status} />
                </td>
                <td>
                  {row.status} · {formatQar(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsListPage>
  );
}
