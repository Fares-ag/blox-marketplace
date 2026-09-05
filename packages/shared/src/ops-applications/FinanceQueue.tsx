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
import { CREDIT_PIPELINE_STATUSES, FINANCE_ACTIVATION_QUEUE_STATUSES } from './constants';
import type { OpsQueueItem } from './types';

type MainTab = 'activation' | 'review';
type ReviewTab = 'pipeline' | 'rejected';

function queueAge(iso?: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/**
 * Finance queue (blox-vercel `FinanceQueuePage`):
 *  - Activation (default): handoff states, **view only** — Activate is on the credit portal.
 *  - Review: credit-parity pipeline / rejected, with decisions on the workspace.
 */
export function FinanceQueue({ detailBase: detailBaseProp }: { detailBase?: string }) {
  const portalBase = usePortalBasePath();
  const detailBase = detailBaseProp ?? withPortalBase('/applications', portalBase);
  const { t, applicationStatus } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('activation');
  const [reviewTab, setReviewTab] = useState<ReviewTab>('pipeline');

  const statusIn =
    mainTab === 'activation'
      ? FINANCE_ACTIVATION_QUEUE_STATUSES.join(',')
      : reviewTab === 'rejected'
        ? 'rejected'
        : CREDIT_PIPELINE_STATUSES.join(',');

  const { data, error, isLoading } = useQuery({
    queryKey: ['finance-queue', page, q, mainTab, reviewTab],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        `/api/ops/applications?${buildPaginationQuery(page)}&statusIn=${statusIn}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const pendingCount = useQuery({
    queryKey: ['finance-queue-metrics-pending'],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        '/api/ops/applications?limit=1&offset=0&statusIn=pending_finance_activation',
      ),
  });
  const reviewCount = useQuery({
    queryKey: ['finance-queue-metrics-review'],
    queryFn: () =>
      apiFetch<PaginatedResponse<OpsQueueItem>>(
        `/api/ops/applications?limit=1&offset=0&statusIn=${CREDIT_PIPELINE_STATUSES.join(',')}`,
      ),
  });

  const items = data?.items ?? [];
  const { total } = paginationWindow(data?.total ?? 0, page);

  const metrics = [
    { label: t('ops.finance.pendingActivation'), value: String(pendingCount.data?.total ?? '—') },
    { label: t('ops.finance.inReview'), value: String(reviewCount.data?.total ?? '—') },
    { label: t('ops.credit.queueTotal'), value: String(total) },
  ];

  const columns: Column<OpsQueueItem>[] = useMemo(
    () => [
      {
        id: 'id',
        label: t('ops.col.application'),
        format: (_, a) => <Link to={`${detailBase}/${a.id}`}>{a.id.slice(0, 10)}…</Link>,
      },
      {
        id: 'vehicle',
        label: t('ops.col.vehicle'),
        format: (_, a) =>
          a.product ? `${a.product.make} ${a.product.model} ${a.product.model_year ?? ''}` : '—',
      },
      {
        id: 'deal',
        label: t('ops.workspace.deal'),
        format: (_, a) =>
          a.deal_summary
            ? `QAR ${a.deal_summary.selling_price.toLocaleString()} · ${a.deal_summary.rate}%`
            : '—',
      },
      {
        id: 'customer',
        label: t('ops.col.customer'),
        format: (_, a) => (
          <>
            {a.customer?.name}
            <br />
            <small>{a.customer?.email}</small>
          </>
        ),
      },
      { id: 'dealer', label: t('ops.col.dealer'), format: (_, a) => a.company?.name ?? '—' },
      {
        id: 'status',
        label: t('ops.col.status'),
        format: (_, a) => (
          <OpsStatusPill label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />
        ),
      },
      { id: 'age', label: t('ops.credit.age'), format: (_, a) => queueAge(a.submitted_at ?? a.created_at) },
    ],
    [t, detailBase, applicationStatus],
  );

  const emptyMessage =
    mainTab === 'activation'
      ? t('ops.finance.activationEmpty')
      : reviewTab === 'rejected'
        ? t('ops.finance.rejectedEmpty')
        : t('ops.common.queueClear');

  return (
    <OpsListPage
      title={t('ops.finance.queueTitle')}
      subtitle={mainTab === 'activation' ? t('ops.finance.activationSubtitle') : t('ops.finance.reviewSubtitle')}
      metrics={metrics}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
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
            <>
              <OpsTabs
                value={mainTab}
                onChange={(_, next) => {
                  setMainTab(next as MainTab);
                  setPage(0);
                }}
              >
                <OpsTab value="activation" label={t('ops.finance.tabActivation')} />
                <OpsTab value="review" label={t('ops.finance.tabReview')} />
              </OpsTabs>
              {mainTab === 'review' && (
                <OpsTabs
                  value={reviewTab}
                  onChange={(_, next) => {
                    setReviewTab(next as ReviewTab);
                    setPage(0);
                  }}
                >
                  <OpsTab value="pipeline" label={t('ops.credit.tabPipeline')} />
                  <OpsTab value="rejected" label={t('ops.credit.tabRejected')} />
                </OpsTabs>
              )}
            </>
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
        emptyMessage={emptyMessage}
      />
    </OpsListPage>
  );
}
