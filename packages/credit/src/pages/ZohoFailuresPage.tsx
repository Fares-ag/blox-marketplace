import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  apiFetch,
  FilterPanel,
  OpsDataTable,
  OpsEmptyState,
  OpsListPage,
  OpsToolbar,
  SearchBar,
  StatusBadge,
  useOpsLabels,
  type FilterConfig,
  type PaginatedResponse,
} from '@drivemarket/shared';

export function ZohoFailuresPage() {
  const { t, applicationStatus } = useOpsLabels();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const { data, error, isLoading } = useQuery({
    queryKey: ['zoho-failures'],
    queryFn: () =>
      apiFetch<
        PaginatedResponse<{
          application_id: string;
          reason: string;
          status: string;
          customer_email: string;
          error: string | null;
        }>
      >('/api/ops/zoho/failures'),
  });
  const statusFilter = typeof filters.status === 'string' ? filters.status : '';
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: 'status',
        label: t('ops.col.status'),
        type: 'select',
        options: [...new Set((data?.items ?? []).map((row) => row.status))].map((value) => ({
          value,
          label: applicationStatus(value),
        })),
      },
    ],
    [applicationStatus, data?.items, t],
  );

  const items = (data?.items ?? []).filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${row.customer_email} ${row.application_id} ${row.error ?? ''} ${row.reason}`.toLowerCase().includes(q);
  });

  return (
    <OpsListPage
      title={t('ops.credit.zohoTitle')}
      subtitle={t('ops.credit.zohoSubtitle')}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          search={<SearchBar value={search} onChange={setSearch} placeholder={t('ops.common.search')} />}
          filters={
            <FilterPanel filters={filterConfigs} values={filters} onChange={setFilters} onClear={() => setFilters({})} />
          }
        />
      }
    >
      {isLoading ? (
        <OpsEmptyState title={t('ops.common.loading')} body="" />
      ) : (
        <OpsDataTable
          columns={[t('ops.col.application'), t('ops.col.customer'), t('ops.col.status'), t('ops.col.error')]}
          empty={<OpsEmptyState title={t('ops.credit.zohoEmpty')} body="" />}
          rows={items.map((row) => [
            <Link key="a" to={`/applications/${row.application_id}`}>
              {row.application_id.slice(0, 8)}…
            </Link>,
            row.customer_email,
            <StatusBadge key="s" status={row.status} type="application" label={applicationStatus(row.status)} />,
            row.error ?? row.reason,
          ])}
        />
      )}
    </OpsListPage>
  );
}
