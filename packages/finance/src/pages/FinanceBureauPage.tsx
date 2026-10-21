import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  apiFetch,
  apiFileUrl,
  OpsContentCard,
  OpsCoreTable,
  OpsListPage,
  OpsPrimaryButton,
  useOpsLabels,
  type OpsTableColumn,
} from '@drivemarket/shared';

type BureauRun = {
  id: string;
  period: string;
  as_of: string;
  as_of_qatar: string;
  map_version: string;
  unsigned: boolean;
  status: 'generated' | 'sent' | 'failed' | string;
  awaiting_approval?: boolean;
  transport: string;
  filename: string | null;
  approved_at?: string | null;
  send_acknowledgement?: string | null;
  checksum: string | null;
  record_count: number;
  excluded_count: number;
  outstanding_sum: number;
  error: string | null;
  triggered_by: string;
  created_at: string;
};

type BureauRunDetail = BureauRun & {
  rows: Array<{
    application_id: string;
    reference_seq: number;
    reference_no: string | null;
    included: boolean;
    exclude_reason: string | null;
    outstanding_source: string | null;
    outstanding: number | null;
    status_code: string | null;
    ibra_amount: number | null;
  }>;
};

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === 'sent') return t('ops.finance.bureauStatusSent');
  if (status === 'generated') return t('ops.finance.bureauStatusGenerated');
  if (status === 'failed') return t('ops.finance.bureauStatusFailed');
  return status;
}

async function downloadRunFile(id: string, fallbackName: string) {
  const res = await fetch(apiFileUrl(`/api/ops/bureau/runs/${id}/file`), { credentials: 'include' });
  if (!res.ok) throw new Error('download_failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const header = res.headers.get('Content-Disposition');
  const named = header?.match(/filename="([^"]+)"/)?.[1];
  link.href = url;
  link.download = named || fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}

export function FinanceBureauPage() {
  const { t } = useOpsLabels();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, isLoading } = useQuery({
    queryKey: ['bureau-runs'],
    queryFn: () => apiFetch<{ items: BureauRun[] }>('/api/ops/bureau/runs'),
  });
  const items = data?.items ?? [];
  const last = items[0] ?? null;
  const detailId = selectedId ?? last?.id ?? null;

  const detail = useQuery({
    queryKey: ['bureau-run', detailId],
    enabled: !!detailId,
    queryFn: () => apiFetch<BureauRunDetail>(`/api/ops/bureau/runs/${detailId}`),
  });

  const run = useMutation({
    mutationFn: () => apiFetch<BureauRun & { record_count?: number; status?: string }>('/api/ops/bureau/runs', { method: 'POST' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['bureau-runs'] });
      if (result.status === 'failed') {
        toast.error(t('ops.finance.bureauRunFailed'));
        return;
      }
      toast.success(t('ops.finance.bureauRunOk', { count: String(result.record_count ?? 0) }));
      if (result.id) setSelectedId(result.id);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const approveSend = useMutation({
    mutationFn: (id: string) =>
      apiFetch<BureauRun>(`/api/ops/bureau/runs/${id}/send`, { method: 'POST' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['bureau-runs'] });
      void queryClient.invalidateQueries({ queryKey: ['bureau-run', result.id] });
      if (result.status === 'failed') {
        toast.error(t('ops.finance.bureauApproveFailed'));
        return;
      }
      toast.success(t('ops.finance.bureauApproveOk'));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const columns: OpsTableColumn<BureauRun>[] = useMemo(
    () => [
      { id: 'period', label: t('ops.finance.bureauPeriod'), format: (_, r) => r.period },
      { id: 'as_of', label: t('ops.finance.bureauLastRun'), format: (_, r) => r.as_of_qatar },
      { id: 'status', label: t('ops.col.status'), format: (_, r) => statusLabel(r.status, t) },
      { id: 'records', label: t('ops.finance.bureauRecords'), format: (_, r) => String(r.record_count) },
      { id: 'excluded', label: t('ops.finance.bureauExcluded'), format: (_, r) => String(r.excluded_count) },
      {
        id: 'map',
        label: t('ops.finance.bureauMap'),
        format: (_, r) => (r.unsigned ? `${r.map_version} · ${t('ops.finance.bureauUnsigned')}` : r.map_version),
      },
    ],
    [t],
  );

  const rowColumns: OpsTableColumn<BureauRunDetail['rows'][number]>[] = useMemo(
    () => [
      { id: 'ref', label: t('ops.finance.reference'), format: (_, r) => r.reference_no ?? String(r.reference_seq) },
      {
        id: 'in',
        label: t('ops.finance.bureauIncluded'),
        format: (_, r) => (r.included ? t('ops.finance.bureauIncluded') : t('ops.finance.bureauNotIncluded')),
      },
      { id: 'reason', label: t('ops.finance.bureauExcludedReason'), format: (_, r) => r.exclude_reason ?? '—' },
      { id: 'status', label: t('ops.col.status'), format: (_, r) => r.status_code ?? '—' },
      {
        id: 'outstanding',
        label: t('ops.finance.bureauOutstanding'),
        format: (_, r) => (r.outstanding == null ? '—' : `QAR ${r.outstanding.toLocaleString()}`),
      },
    ],
    [t],
  );

  return (
    <OpsListPage title={t('ops.finance.bureauTitle')} subtitle={t('ops.finance.bureauSubtitle')}>
      <OpsContentCard>
        <p>{t('ops.finance.bureauTriggerHint')}</p>
        {last ? (
          <p>
            {t('ops.finance.bureauLastRun')}: {statusLabel(last.status, t)} · {last.period} · {last.record_count}/
            {last.excluded_count} · {last.map_version}
            {last.send_acknowledgement ? ` · ${last.send_acknowledgement}` : null}
          </p>
        ) : null}
        <div className="blox-inline-actions blox-inline-actions--wrap">
          <OpsPrimaryButton type="button" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? t('ops.finance.bureauRunning') : t('ops.finance.bureauRunDryRun')}
          </OpsPrimaryButton>
          {detail.data?.status === 'generated' && detail.data.filename ? (
            <OpsPrimaryButton
              type="button"
              disabled={approveSend.isPending}
              onClick={() => approveSend.mutate(detail.data!.id)}
            >
              {approveSend.isPending ? t('ops.finance.bureauApproveSending') : t('ops.finance.bureauApproveSend')}
            </OpsPrimaryButton>
          ) : null}
          {detail.data?.filename ? (
            <OpsPrimaryButton
              type="button"
              onClick={() =>
                void downloadRunFile(detail.data!.id, detail.data!.filename ?? 'bureau.dlt').catch((err) =>
                  toast.error((err as Error).message || t('ops.finance.bureauNoFile')),
                )
              }
            >
              {t('ops.finance.bureauDownload')}
            </OpsPrimaryButton>
          ) : null}
        </div>
      </OpsContentCard>

      <OpsCoreTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        emptyMessage={t('ops.finance.bureauEmpty')}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      {detail.data ? (
        <OpsCoreTable
          columns={rowColumns}
          rows={detail.data.rows}
          rowKey={(row) => `${row.application_id}-${row.included ? 'in' : row.exclude_reason}`}
          loading={detail.isLoading}
          emptyMessage={t('ops.finance.bureauEmpty')}
        />
      ) : null}
    </OpsListPage>
  );
}
