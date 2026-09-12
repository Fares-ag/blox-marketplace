import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildPaginationQuery, DEFAULT_PAGE_SIZE, paginationWindow } from '../lib/api';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
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
import type { FinancePartnerAdminDto } from '../types/customer-platform';
import type { OpsMetricItem } from '../ops-ui-v2/OpsMetricRow';
import type { OpsAudience, OpsQueueItem } from './types';

type DealerListMetrics = {
  applications_by_status: Record<string, number>;
  open_applications: number;
  submissions_this_month: number;
  submissions_by_week: Array<{ label: string; count: number }>;
};

function partnerItems(
  data: FinancePartnerAdminDto[] | PaginatedResponse<FinancePartnerAdminDto> | undefined,
): FinancePartnerAdminDto[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

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
  basePath: basePathProp,
  createPath,
}: {
  audience: OpsAudience;
  /** Detail route prefix; defaults to the portal-aware `/applications`. */
  basePath?: string;
  createPath?: string;
}) {
  const portalBase = usePortalBasePath();
  const basePath = basePathProp ?? withPortalBase('/applications', portalBase);
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
  const financePartnerId = typeof filters.financePartnerId === 'string' ? filters.financePartnerId : '';
  const scheduleHealth = typeof filters.scheduleHealth === 'string' ? filters.scheduleHealth : '';
  const createdRange = (filters.createdRange as { startDate?: string; endDate?: string }) ?? {};

  const path = dealer
    ? `/api/dealer/applications?${buildPaginationQuery(page)}${q ? `&q=${encodeURIComponent(q)}` : ''}${dealerTab !== 'all' ? `&tab=${dealerTab}` : ''}`
    : `/api/ops/applications?${buildPaginationQuery(page)}${q ? `&q=${encodeURIComponent(q)}` : ''}${statusIn ? `&statusIn=${encodeURIComponent(statusIn)}` : ''}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ''}${financePartnerId ? `&financePartnerId=${encodeURIComponent(financePartnerId)}` : ''}${scheduleHealth ? `&scheduleHealth=${encodeURIComponent(scheduleHealth)}` : ''}${createdRange.startDate ? `&createdFrom=${createdRange.startDate}` : ''}${createdRange.endDate ? `&createdTo=${createdRange.endDate}` : ''}`;

  const { data, error, isLoading } = useQuery({
    queryKey: ['ops-apps', audience, page, q, tab, dealerTab, companyId, financePartnerId, scheduleHealth, createdRange],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem> & { metrics?: { loan_value: number; receivable: number; avg_payment: number } }>(path),
  });
  const dealerMetricsQuery = useQuery({
    queryKey: ['dealer-metrics', 'applications-list'],
    queryFn: () => apiFetch<DealerListMetrics>('/api/ops/metrics/dealer'),
    enabled: dealer,
  });
  const items = data?.items ?? [];
  const { total } = paginationWindow(data?.total ?? 0, page);
  const metrics = data?.metrics;

  const companies = useQuery({
    queryKey: ['ops-companies-filter'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string; name: string }>>('/api/companies/all?limit=100&offset=0'),
    enabled: !dealer,
  });

  // Lender filter (`financePartnerId`): the finance-provider master, admin / finance / super-admin lists only.
  const partners = useQuery({
    queryKey: ['finance-partners', 'list-filter'],
    queryFn: () =>
      apiFetch<FinancePartnerAdminDto[] | PaginatedResponse<FinancePartnerAdminDto>>('/api/finance-partners?limit=100&offset=0'),
    enabled: !dealer,
    retry: false,
  });
  const lenders = partnerItems(partners.data);

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
    if (!dealer && lenders.length > 0) {
      configs.push({
        id: 'financePartnerId',
        label: t('financeProviders.lender'),
        type: 'select',
        options: lenders.map((p) => ({ value: p.id, label: p.name })),
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
  }, [companies.data, dealer, lenders, t]);

  const listMetrics = useMemo((): OpsMetricItem[] | undefined => {
    if (dealer) {
      const dm = dealerMetricsQuery.data;
      const loading = dealerMetricsQuery.isLoading;
      const dash = (n: number) => (loading ? '—' : String(n));
      const status = dm?.applications_by_status ?? {};
      const totalApps = Object.values(status).reduce((sum, n) => sum + n, 0);
      const active =
        (status.active ?? 0) +
        (status.down_payment_required ?? 0) +
        (status.down_payment_submitted ?? 0) +
        (status.pending_finance_activation ?? 0);
      return [
        { label: t('ops.dealer.summaryTotal'), value: dash(totalApps), tone: 'brand' },
        { label: t('ops.dashboard.openApplications'), value: dash(dm?.open_applications ?? 0), tone: 'info' },
        { label: t('ops.dashboard.resubmissions'), value: dash(status.resubmission_required ?? 0), tone: 'warning' },
        {
          label: t('ops.dashboard.submissionsMonth'),
          value: dash(dm?.submissions_this_month ?? 0),
          trend: dm?.submissions_by_week?.map((w) => w.count),
          tone: 'progress',
        },
        { label: t('ops.dashboard.activeFinancings'), value: dash(active), tone: 'success' },
      ];
    }
    if (!metrics) return undefined;
    return [
      { label: 'Loan value', value: `QAR ${(metrics.loan_value ?? 0).toLocaleString()}` },
      { label: 'Receivable', value: `QAR ${(metrics.receivable ?? 0).toLocaleString()}` },
      { label: 'Avg payment', value: `QAR ${(metrics.avg_payment ?? 0).toLocaleString()}` },
    ];
  }, [dealer, dealerMetricsQuery.data, dealerMetricsQuery.isLoading, metrics, t]);

  const columns: Column<OpsQueueItem>[] = useMemo(
    () => [
      {
        id: 'vehicle',
        cardTitle: true,
        label: t('ops.col.vehicle'),
        format: (_, a) => {
          const ownership = listOwnershipPct(a.status);
          return (
            <div className="blox-cell-stack">
              <Link to={`${basePath}/${a.id}`} className="blox-table__primary">
                {a.product ? `${a.product.make} ${a.product.model}` : a.id.slice(0, 8)}
              </Link>
              {ownership && <OwnershipBar customerPct={ownership.customer} bloxPct={ownership.blox} />}
              <span className="blox-table__meta">
                {a.id.slice(0, 8)}
                {a.deal_summary ? ` · ${formatQar(a.deal_summary.selling_price)} · ${a.deal_summary.rate}%` : ''}
              </span>
            </div>
          );
        },
      },
      {
        id: 'customer',
        cardTitle: true,
        label: t('ops.col.customer'),
        format: (_, a) => (
          <span className="blox-cell-stack">
            <span className="blox-table__primary">{a.customer?.name ?? a.customer?.email ?? '—'}</span>
            {a.customer?.name && a.customer?.email ? <span className="blox-table__meta">{a.customer.email}</span> : null}
          </span>
        ),
      },
      {
        id: 'dealer',
        label: t('ops.col.dealer'),
        format: (_, a) => a.company?.name ?? a.agent?.name ?? '—',
      },
      {
        id: 'status',
        sortable: true,
        cardStatus: true,
        label: t('ops.col.status'),
        format: (_, a) => (
          <div className="blox-cell-row">
            <OpsStatusPill label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />
            {a.status === 'active' && a.payment_health === 'on_track' && (
              <OpsStatusPill label={t('ops.workspace.onTrack')} variant="outline" />
            )}
            {a.identity_hold_reason && !a.identity_hold_cleared_at && (
              <OpsStatusPill label={t('identityHold.badge')} variant="danger" />
            )}
          </div>
        ),
      },
      {
        id: 'finance',
        label: t('financeProviders.lender'),
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
        sortable: true,
        label: t('ops.col.created'),
        align: 'right',
        format: (_, a) => (
          <span className="blox-table__mono">{new Date(a.created_at).toLocaleDateString()}</span>
        ),
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
      error={error ? (error as Error).message : undefined}
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
        defaultSort={{ id: 'created_at', dir: 'desc' }}
        emptyMessage={t('ops.common.noResults')}
      />
    </OpsListPage>
  );
}
