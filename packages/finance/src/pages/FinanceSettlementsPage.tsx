import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  apiFetch,
  ConfirmDialog,
  OpsCoreTable,
  OpsDangerButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsTab,
  OpsTabs,
  OpsToolbar,
  useOpsLabels,
  type OpsTableColumn,
} from '@drivemarket/shared';

export type SettlementRow = {
  id: string;
  application_id: string;
  application_status: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  customer_email: string;
  customer_name: string | null;
  vehicle: string;
  company_name: string;
  settlement_amount: number;
  remaining_principal: number;
  discount_amount: number;
  forgiven_rent: number;
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
};

type SettlementsResponse = { total: number; summary: { pending: number }; items: SettlementRow[] };

const PAGE = 50;

/** blox-vercel `/finance/settlements` — approve / reject pending early-settlement requests. */
export function FinanceSettlementsPage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [confirm, setConfirm] = useState<{ row: SettlementRow; decision: 'approved' | 'rejected' } | null>(null);
  const [reason, setReason] = useState('');

  const { data, error, isLoading } = useQuery({
    queryKey: ['finance-settlements', page, tab],
    queryFn: () =>
      apiFetch<SettlementsResponse>(
        `/api/ops/settlements?limit=${PAGE}&offset=${page * PAGE}${tab === 'pending' ? '&status=pending' : ''}`,
      ),
  });

  const decide = useMutation({
    mutationFn: (p: { id: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      apiFetch(`/api/ops/settlements/${p.id}/${p.decision === 'approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify({ reason: p.reason || undefined }),
      }),
    onSuccess: () => {
      toast.success(t('ops.finance.settlementUpdated'));
      void qc.invalidateQueries({ queryKey: ['finance-settlements'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: OpsTableColumn<SettlementRow>[] = useMemo(
    () => [
      { id: 'requested_at', label: t('ops.finance.requestedAt'), format: (_, r) => r.requested_at.slice(0, 10) },
      {
        id: 'customer',
        label: t('ops.col.customer'),
        format: (_, r) => (
          <Link to={`/applications/${r.application_id}`}>
            {r.customer_name ?? r.customer_email}
            <br />
            <small>{r.customer_email}</small>
          </Link>
        ),
      },
      { id: 'vehicle', label: t('ops.col.vehicle'), format: (_, r) => r.vehicle },
      { id: 'company_name', label: t('ops.col.dealer'), format: (_, r) => r.company_name },
      {
        id: 'remaining_principal',
        label: t('ops.finance.remainingPrincipal'),
        format: (_, r) => `QAR ${r.remaining_principal.toLocaleString()}`,
      },
      {
        id: 'settlement_amount',
        label: t('ops.finance.settlementAmount'),
        format: (_, r) => `QAR ${r.settlement_amount.toLocaleString()}`,
      },
      { id: 'status', label: t('ops.col.status'), format: (_, r) => r.status },
      {
        id: 'actions',
        label: '',
        format: (_, r) =>
          r.status === 'pending' ? (
            <span className="blox-inline-actions">
              <OpsPrimaryButton
                type="button"
                disabled={decide.isPending}
                onClick={() => setConfirm({ row: r, decision: 'approved' })}
              >
                {t('ops.finance.approveSettlement')}
              </OpsPrimaryButton>
              <OpsDangerButton
                type="button"
                disabled={decide.isPending}
                onClick={() => {
                  setReason('');
                  setConfirm({ row: r, decision: 'rejected' });
                }}
              >
                {t('ops.finance.rejectSettlement')}
              </OpsDangerButton>
            </span>
          ) : (
            <small>{r.decision_reason ?? ''}</small>
          ),
      },
    ],
    [t, decide.isPending],
  );

  return (
    <OpsListPage
      title={t('ops.finance.settlementsTitle')}
      subtitle={t('ops.finance.settlementsSubtitle')}
      metrics={[{ label: t('ops.finance.pendingSettlements'), value: String(data?.summary.pending ?? '—') }]}
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          tabs={
            <OpsTabs
              value={tab}
              onChange={(_, next) => {
                setTab(next as 'pending' | 'all');
                setPage(0);
              }}
            >
              <OpsTab value="pending" label={t('ops.finance.pendingSettlements')} />
              <OpsTab value="all" label={t('ops.finance.allSettlements')} />
            </OpsTabs>
          }
        />
      }
    >
      <OpsCoreTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        page={page}
        rowsPerPage={PAGE}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.settlementsEmpty')}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.decision === 'approved' ? t('ops.finance.approveSettlement') : t('ops.finance.rejectSettlement')}
        message={
          confirm
            ? confirm.decision === 'approved'
              ? t('ops.finance.approveSettlementConfirm', {
                  amount: confirm.row.settlement_amount.toLocaleString(),
                  email: confirm.row.customer_email,
                })
              : t('ops.finance.rejectSettlementConfirm', { email: confirm.row.customer_email })
            : ''
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.decision === 'rejected' && !reason.trim()) {
            toast.error(t('ops.finance.rejectReason'));
            return;
          }
          decide.mutate({ id: confirm.row.id, decision: confirm.decision, reason: reason.trim() });
          setConfirm(null);
        }}
      >
        {confirm?.decision === 'rejected' && (
          <label className="blox-field">
            <span>{t('ops.finance.rejectReason')}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </label>
        )}
      </ConfirmDialog>
    </OpsListPage>
  );
}
