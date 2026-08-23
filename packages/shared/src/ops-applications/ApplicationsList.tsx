import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Chip } from '@mui/material';
import { apiFetch, buildPaginationQuery, DEFAULT_PAGE_SIZE, paginationWindow } from '../lib/api';
import { formatQar } from '../lib/format';
import { applicationOpsPillVariant } from '../config/status-styles';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsStatusPill } from '../components/ops-ui';
import {
  FilterPanel,
  OpsListPage,
  OpsTab,
  OpsTabs,
  OpsToolbar,
  OwnershipBar,
  SearchBar,
  Table,
  type Column,
  type FilterConfig,
} from '../ops-ui-v2';
import type { PaginatedResponse } from '../types/domain';
import type { OpsAudience, OpsQueueItem } from './types';

const STATUS_TABS = [
  { id: 'all', statusIn: '' },
  { id: 'inprogress', statusIn: 'under_review,resubmission_required,draft' },
  { id: 'contracts', statusIn: 'contract_signing_required,contracts_submitted,contract_under_review' },
  { id: 'active', statusIn: 'active,down_payment_required,down_payment_submitted,pending_finance_activation' },
  { id: 'rejected', statusIn: 'rejected' },
  { id: 'completed', statusIn: 'completed' },
  { id: 'cancelled', statusIn: 'submission_cancelled' },
  { id: 'partner', statusIn: 'partner_processing' },
] as const;

function listOwnershipPct(status: string): { customer: number; blox: number } | null {
  if (status === 'completed') return { customer: 100, blox: 0 };
  if (status === 'active' || status === 'pending_finance_activation') return { customer: 35, blox: 65 };
  if (status === 'down_payment_required' || status === 'down_payment_submitted') return { customer: 15, blox: 85 };
  return null;
}

export function ApplicationsList({
  audience,
  basePath,
  createPath,
}: {
  audience: OpsAudience;
  basePath: string;
  createPath?: string;
}) {
  const { t, applicationStatus } = useOpsLabels();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState(Number(searchParams.get('tab') ?? 0));
  const [dealerTab, setDealerTab] = useState<'all' | 'mine' | 'resubmission'>('all');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const dealer = audience === 'dealer';
  const statusIn = STATUS_TABS[tab]?.statusIn ?? '';

  const companyId = typeof filters.companyId === 'string' ? filters.companyId : '';
  const scheduleHealth = typeof filters.scheduleHealth === 'string' ? filters.scheduleHealth : '';
  const createdRange = (filters.createdRange as { startDate?: string; endDate?: string }) ?? {};

  const path = dealer
    ? `/api/dealer/applications?${buildPaginationQuery(page)}${q ? `&q=${encodeURIComponent(q)}` : ''}${dealerTab !== 'all' ? `&tab=${dealerTab}` : ''}`
    : `/api/ops/applications?${buildPaginationQuery(page)}${q ? `&q=${encodeURIComponent(q)}` : ''}${statusIn ? `&statusIn=${encodeURIComponent(statusIn)}` : ''}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ''}${scheduleHealth ? `&scheduleHealth=${encodeURIComponent(scheduleHealth)}` : ''}${createdRange.startDate ? `&createdFrom=${createdRange.startDate}` : ''}${createdRange.endDate ? `&createdTo=${createdRange.endDate}` : ''}`;

  const { data, error, isLoading } = useQuery({
    queryKey: ['ops-apps', audience, page, q, tab, dealerTab, companyId, scheduleHealth, createdRange],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem> & { metrics?: { loan_value: number; receivable: number; avg_payment: number } }>(path),
  });
  const items = data?.items ?? [];
  const { total } = paginationWindow(data?.total ?? 0, page);
  const metrics = data?.metrics;

  const companies = useQuery({
    queryKey: ['ops-companies-filter'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string; name: string }>>('/api/companies/all?limit=100&offset=0'),
    enabled: !dealer,
  });

  const filterConfigs: FilterConfig[] = useMemo(() => {
    const configs: FilterConfig[] = [];
    if (!dealer) {
      configs.push({
        id: 'companyId',
        label: 'Company',
        type: 'select',
        options: (companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
      });
    }
    configs.push(
      {
        id: 'scheduleHealth',
        label: 'Payment schedule',
        type: 'select',
        options: [
          { value: 'on_track', label: 'On track' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'none', label: 'No schedule' },
        ],
      },
      { id: 'createdRange', label: 'Created date', type: 'daterange' },
    );
    return configs;
  }, [companies.data, dealer]);

  const listMetrics = !dealer && metrics
    ? [
        { label: 'Loan value', value: `QAR ${(metrics.loan_value ?? 0).toLocaleString()}` },
        { label: 'Receivable', value: `QAR ${(metrics.receivable ?? 0).toLocaleString()}` },
        { label: 'Avg payment', value: `QAR ${(metrics.avg_payment ?? 0).toLocaleString()}` },
      ]
    : undefined;

  const columns: Column<OpsQueueItem>[] = useMemo(
    () => [
      {
        id: 'vehicle',
        label: t('ops.col.vehicle'),
        format: (_, a) => {
          const ownership = listOwnershipPct(a.status);
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Link to={`${basePath}/${a.id}`}>
                {a.product ? `${a.product.make} ${a.product.model}` : a.id.slice(0, 8)}
              </Link>
              {ownership && <OwnershipBar customerPct={ownership.customer} bloxPct={ownership.blox} />}
              {a.deal_summary && (
                <small>{formatQar(a.deal_summary.selling_price)} · {a.deal_summary.rate}%</small>
              )}
            </Box>
          );
        },
      },
      {
        id: 'customer',
        label: t('ops.col.customer'),
        format: (_, a) => a.customer?.name ?? a.customer?.email ?? '—',
      },
      {
        id: 'dealer',
        label: t('ops.col.dealer'),
        format: (_, a) => a.company?.name ?? a.agent?.name ?? '—',
      },
      {
        id: 'status',
        label: t('ops.col.status'),
        format: (_, a) => (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <OpsStatusPill label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />
            {a.status === 'active' && a.payment_health === 'on_track' && (
              <Chip size="small" label={t('ops.workspace.onTrack')} />
            )}
          </Box>
        ),
      },
      {
        id: 'finance',
        label: 'Finance',
        format: (_, a) => a.finance_partner_name ?? (a.financing_source === 'partner' ? t('ops.common.partnerFinance') : t('ops.common.bloxFinance')),
      },
      {
        id: 'payment_health',
        label: t('ops.workspace.paymentHealth'),
        format: (_, a) => a.payment_health ?? '—',
      },
      {
        id: 'risk',
        label: t('ops.workspace.risk'),
        format: (_, a) => a.risk_level ?? '—',
      },
      {
        id: 'created_at',
        label: t('ops.col.created'),
        format: (_, a) => new Date(a.created_at).toLocaleDateString(),
      },
    ],
    [t, basePath, applicationStatus],
  );

  return (
    <OpsListPage
      title={t(dealer ? 'ops.dealer.applicationsTitle' : 'ops.admin.applicationsTitle')}
      subtitle={t(dealer ? 'ops.dealer.applicationsSubtitle' : 'ops.admin.applicationsSubtitle')}
      headerActions={
        createPath ? (
          <Link to={createPath} className="blox-btn blox-btn--primary">
            {t('ops.wizard.newApplication')}
          </Link>
        ) : undefined
      }
      metrics={listMetrics}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(0);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (value) next.set('q', value);
                  else next.delete('q');
                  return next;
                });
              }}
              placeholder={t('ops.common.search')}
            />
          }
          tabs={
            dealer ? (
              <OpsTabs
                value={dealerTab}
                onChange={(_, next) => {
                  setDealerTab(next);
                  setPage(0);
                }}
              >
                <OpsTab value="all" label={t('ops.dealer.tabAll')} />
                <OpsTab value="mine" label={t('ops.dealer.tabMine')} />
                <OpsTab value="resubmission" label={t('ops.dealer.tabResubmission')} />
              </OpsTabs>
            ) : (
              <OpsTabs
                value={tab}
                onChange={(_, next) => {
                  setTab(next);
                  setPage(0);
                  setSearchParams((prev) => {
                    const nextParams = new URLSearchParams(prev);
                    nextParams.set('tab', String(next));
                    return nextParams;
                  });
                }}
                variant="scrollable"
              >
                <OpsTab label="All" />
                <OpsTab label="In progress" />
                <OpsTab label="Contracts" />
                <OpsTab label="Active" />
                <OpsTab label="Rejected" />
                <OpsTab label="Completed" />
                <OpsTab label="Cancelled" />
                <OpsTab label="Partner" />
              </OpsTabs>
            )
          }
          filters={<FilterPanel filters={filterConfigs} values={filters} onChange={setFilters} onClear={() => setFilters({})} />}
        />
      }
    >
      <Table
        columns={columns}
        rows={items}
        loading={isLoading}
        page={page}
        rowsPerPage={DEFAULT_PAGE_SIZE}
        totalRows={total}
        onPageChange={setPage}
        emptyMessage={t('ops.common.noResults')}
      />
    </OpsListPage>
  );
}
