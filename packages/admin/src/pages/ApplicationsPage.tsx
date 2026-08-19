import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, OpsEmptyState } from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill, type PillVariant } from '../components/ui';

function statusVariant(status: string): PillVariant {
  if (status === 'active' || status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

export function ApplicationsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error } = useQuery({
    queryKey: ['admin-apps'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          status: string;
          createdAt: string;
          customer: { name: string; email: string };
          product: { make: string; model: string; modelYear: number };
          company: { name: string };
        }>
      >('/api/ops/applications'),
  });

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

  const selected = data?.find((a) => a.id === selectedId);

  return (
    <div className="blox-page">
      <PageHeader title="Applications" subtitle="Vehicle financing applications across all dealers" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <DataTable
        columns={['Customer', 'Vehicle', 'Dealer', 'Status', 'Created', '']}
        empty={<OpsEmptyState title="No open applications" body="Applications in review appear here." />}
        rows={(data ?? []).map((a) => [
          <span key="c" title={a.customer.email}>{a.customer.name}</span>,
          `${a.product.make} ${a.product.model} ${a.product.modelYear}`,
          a.company.name,
          <StatusPill key="s" label={a.status} variant={statusVariant(a.status)} />,
          new Date(a.createdAt).toLocaleDateString(),
          <button key="b" type="button" className="blox-btn blox-btn--ghost" onClick={() => setSelectedId(a.id)}>
            Manage
          </button>,
        ])}
      />

      {selected && (
        <section className="blox-panel" style={{ marginTop: 24, maxWidth: 560 }}>
          <h2 className="blox-panel__title">
            {selected.product.make} {selected.product.model} · {selected.status}
          </h2>
          {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
          <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem' }}>
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              className="blox-btn blox-btn--secondary"
              onClick={() => transition.mutate({ id: selected.id, toStatus: 'resubmission_required' })}
            >
              Request resubmission
            </button>
            <button
              type="button"
              className="blox-btn blox-btn--danger"
              onClick={() => transition.mutate({ id: selected.id, toStatus: 'rejected' })}
            >
              Reject
            </button>
            {selected.status === 'pending_finance_activation' && (
              <button
                type="button"
                className="blox-btn blox-btn--primary"
                onClick={() =>
                  apiFetch(`/api/ops/applications/${selected.id}/activate`, {
                    method: 'POST',
                    body: '{}',
                  }).then(() => void qc.invalidateQueries({ queryKey: ['admin-apps'] }))
                }
              >
                Activate
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
