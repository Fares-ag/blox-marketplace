import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  OpsEmptyState,
  buildPaginationQuery,
  paginationWindow,
  applicationOpsPillVariant,
  useOpsLabels,
} from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill } from '../components/ui';

export function ApplicationsPage() {
  const { t, applicationStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [page, setPage] = useState(0);

  const { data, error } = useQuery({
    queryKey: ['admin-apps', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          status: string;
          createdAt: string;
          customer: { name: string; email: string };
          product: { make: string; model: string; modelYear: number };
          company: { name: string };
        }>;
      }>(`/api/ops/applications?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  const transition = useMutation({
    mutationFn: (payload: { id: string; toStatus: string }) =>
      apiFetch(`/api/ops/applications/${payload.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus: payload.toStatus, reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin-apps'] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/ops/applications/${id}/activate`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin-apps'] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const selected = items.find((a) => a.id === selectedId);
  const busy = transition.isPending || activate.isPending;
  const selectedLabel = selected
    ? `${selected.product.make} ${selected.product.model} · ${selected.customer.name}`
    : '';

  return (
    <div className="blox-page">
      <PageHeader title={t('ops.admin.applicationsTitle')} subtitle={t('ops.admin.applicationsSubtitle')} />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <DataTable
        columns={[
          t('ops.col.customer'),
          t('ops.col.vehicle'),
          t('ops.col.dealer'),
          t('ops.col.status'),
          t('ops.col.created'),
          '',
        ]}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={
          <OpsEmptyState title={t('ops.admin.noOpenApps')} body={t('ops.admin.noOpenAppsBody')} />
        }
        rows={items.map((a) => [
          <span key="c" title={a.customer.email}>{a.customer.name}</span>,
          `${a.product.make} ${a.product.model} ${a.product.modelYear}`,
          a.company.name,
          <StatusPill key="s" label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />,
          new Date(a.createdAt).toLocaleDateString(),
          <button key="b" type="button" className="blox-btn blox-btn--ghost" onClick={() => setSelectedId(a.id)}>
            {t('ops.common.manage')}
          </button>,
        ])}
      />

      {selected && (
        <section className="blox-panel" style={{ marginTop: 24, maxWidth: 560 }}>
          <h2 className="blox-panel__title">
            {selected.product.make} {selected.product.model} · {applicationStatus(selected.status)}
          </h2>
          {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
          <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem' }}>
            {t('ops.common.reason')}
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              className="blox-btn blox-btn--secondary"
              disabled={busy}
              onClick={() => transition.mutate({ id: selected.id, toStatus: 'resubmission_required' })}
            >
              {t('ops.admin.requestResubmission')}
            </button>
            <button
              type="button"
              className="blox-btn blox-btn--danger"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t('ops.admin.rejectConfirm', { label: selectedLabel }))) return;
                transition.mutate({ id: selected.id, toStatus: 'rejected' });
              }}
            >
              {t('ops.common.reject')}
            </button>
            {selected.status === 'pending_finance_activation' && (
              <button
                type="button"
                className="blox-btn blox-btn--primary"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(t('ops.admin.activateConfirm', { label: selectedLabel }))) return;
                  activate.mutate(selected.id);
                }}
              >
                {activate.isPending ? t('ops.common.activating') : t('ops.admin.activate')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
