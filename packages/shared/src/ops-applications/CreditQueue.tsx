import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildPaginationQuery, DEFAULT_PAGE_SIZE, paginationWindow } from '../lib/api';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import { applicationOpsPillVariant } from '../config/status-styles';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsStatusPill } from '../components/ops-ui';
import { OpsListPage, OpsTab, OpsTabs, OpsToolbar, SearchBar, Table, type Column } from '../ops-ui-v2';
import type { PaginatedResponse } from '../types/domain';
import { CREDIT_PIPELINE_STATUSES, CREDIT_HARDSHIP_QUEUE_STATUSES } from './constants';
import type { OpsQueueItem } from './types';

function queueAge(iso?: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function queueAgeHours(iso?: string | null) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / 3_600_000 : 0;
}

export function CreditQueue({
  detailBase: detailBaseProp,
  initialTab = 'pipeline',
}: {
  detailBase?: string;
  initialTab?: 'pipeline' | 'rejected' | 'hardship';
}) {
  const portalBase = usePortalBasePath();
  const detailBase = detailBaseProp ?? withPortalBase('/applications', portalBase);
  const { t, applicationStatus } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'pipeline' | 'rejected' | 'hardship'>(initialTab);
  const statusIn =
    tab === 'rejected'
      ? 'rejected'
      : tab === 'hardship'
        ? CREDIT_HARDSHIP_QUEUE_STATUSES.join(',')
        : CREDIT_PIPELINE_STATUSES.join(',');

  const { data, error, isLoading } = useQuery({
    queryKey: ['credit-queue', page, q, tab],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        `/api/ops/applications?${buildPaginationQuery(page)}&statusIn=${statusIn}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const reviewCount = useQuery({
    queryKey: ['credit-queue-metrics-review'],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        '/api/ops/applications?limit=1&offset=0&statusIn=under_review,contract_under_review',
      ),
  });

  const resubCount = useQuery({
    queryKey: ['credit-queue-metrics-resub'],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        '/api/ops/applications?limit=1&offset=0&statusIn=resubmission_required',
      ),
  });

  const items = data?.items ?? [];
  const { total } = paginationWindow(data?.total ?? 0, page);
  const subtitle = useMemo(() => t('ops.credit.queueSubtitle'), [t]);

  const avgAgeHours =
    items.length > 0
      ? items.reduce((sum, a) => sum + queueAgeHours(a.submitted_at ?? a.created_at), 0) / items.length
      : 0;
  const avgAgeLabel = avgAgeHours >= 24 ? `${Math.floor(avgAgeHours / 24)}d` : `${Math.floor(avgAgeHours)}h`;

  const queueMetrics = [
    { label: t('ops.credit.inReview'), value: String(reviewCount.data?.total ?? '—') },
    { label: t('ops.credit.resubmission'), value: String(resubCount.data?.total ?? '—') },
    { label: t('ops.credit.avgAge'), value: items.length ? avgAgeLabel : '—' },
    { label: t('ops.credit.queueTotal'), value: String(total) },
  ];

  const columns: Column<OpsQueueItem>[] = useMemo(
    () => [
      {
        id: 'id',
        mono: true,
        label: t('ops.col.application'),
        format: (_, a) => (
          <Link to={`${detailBase}/${a.id}`}>
            {a.reference_no ?? `${a.id.slice(0, 10)}…`}
          </Link>
        ),
      },
      {
        id: 'vehicle',
        label: t('ops.col.vehicle'),
        format: (_, a) => (
          <span className="blox-cell-stack">
            <span className="blox-table__primary">
              {a.product ? `${a.product.make} ${a.product.model}` : '—'}
            </span>
            {a.product?.model_year ? <span className="blox-table__meta">{a.product.model_year}</span> : null}
          </span>
        ),
      },
      {
        id: 'deal',
        label: t('ops.workspace.deal'),
        numeric: true,
        format: (_, a) =>
          a.deal_summary
            ? `QAR ${a.deal_summary.selling_price.toLocaleString()} · ${a.deal_summary.rate}%`
            : '—',
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
        format: (_, a) => a.company?.name ?? '—',
      },
      {
        id: 'agent',
        label: t('ops.credit.agent'),
        format: (_, a) => a.agent?.name ?? a.agent?.email ?? '—',
      },
      {
        id: 'status',
        sortable: true,
        cardStatus: true,
        label: t('ops.col.status'),
        format: (_, a) => (
          <OpsStatusPill label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />
        ),
      },
      {
        id: 'finance',
        label: 'Finance',
        format: (_, a) => a.finance_partner_name ?? t('ops.common.bloxFinance'),
      },
      {
        id: 'age',
        label: t('ops.credit.age'),
        format: (_, a) => queueAge(a.submitted_at ?? a.created_at),
      },
    ],
    [t, detailBase, applicationStatus],
  );

  return (
    <OpsListPage
      title={t('ops.credit.queueTitle')}
      subtitle={subtitle}
      metrics={queueMetrics}
      error={error ? (error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(0);
              }}
              placeholder={t('ops.common.search')}
            />
          }
          tabs={
            <OpsTabs
              value={tab}
              onChange={(_, next) => {
                setTab(next);
                setPage(0);
              }}
            >
              <OpsTab value="pipeline" label={t('ops.credit.tabPipeline')} />
              <OpsTab value="rejected" label={t('ops.credit.tabRejected')} />
              <OpsTab value="hardship" label={t('ops.credit.nav.hardship')} />
            </OpsTabs>
          }
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
        emptyMessage={t('ops.common.queueClear')}
      />
    </OpsListPage>
  );
}
