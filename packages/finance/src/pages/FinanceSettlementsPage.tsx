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
  /** Rent earned up to the quote date (Diminishing Musharakah settlement, wave 2). */
  accrued_profit?: number | null;
  quote_as_of?: string | null;
  /** What the customer keeps versus simply completing the schedule. */
  savings?: number | null;
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
};

type SettlementsResponse = { total: number; summary: { pending: number }; items: SettlementRow[] };

const PAGE = 50;

function qar(value: number | null | undefined): string {
  return value == null ? '—' : `QAR ${Number(value).toLocaleString()}`;
}

/**
 * blox-vercel `/finance/settlements` — approve / reject pending early-settlement requests.
 * Each row shows the quote the customer accepted: principal outstanding, rent to date,
 * forgiven rent and the saving against the remaining schedule.
 */
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
      {
        id: 'requested_at',
        label: t('ops.finance.requestedAt'),
        format: (_, r) => (
          <span className="blox-cell-stack">
            <span>{r.requested_at.slice(0, 10)}</span>
            <small className="blox-table__id">
              {r.quote_as_of
                ? t('dealerOps.settlement.quoteAsOf', { date: new Date(r.quote_as_of).toLocaleDateString() })
                : t('dealerOps.settlement.noQuote')}
            </small>
          </span>
        ),
      },
      {
        id: 'customer',
        cardTitle: true,
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
      { id: 'company_name', hideOnCard: true, label: t('ops.col.dealer'), format: (_, r) => r.company_name },
      {
        id: 'remaining_principal',
        numeric: true,
        label: t('dealerOps.settlement.principalOutstanding'),
        format: (_, r) => qar(r.remaining_principal),
      },
      {
        id: 'accrued_profit',
        numeric: true,
        label: t('dealerOps.settlement.accruedProfit'),
        format: (_, r) => qar(r.accrued_profit),
      },
      {
        id: 'forgiven_rent',
        numeric: true,
        label: t('dealerOps.settlement.forgivenRent'),
        format: (_, r) => qar(r.forgiven_rent),
      },
      {
        id: 'settlement_amount',
        numeric: true,
        label: t('ops.finance.settlementAmount'),
        format: (_, r) => <strong>{qar(r.settlement_amount)}</strong>,
      },
      {
        id: 'savings',
        numeric: true,
        label: t('dealerOps.settlement.savings'),
        format: (_, r) => qar(r.savings),
      },
      { id: 'status', cardStatus: true, label: t('ops.col.status'), format: (_, r) => r.status },
      {
        id: 'actions',
        actions: true,
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
      error={error ? (error as Error).message : undefined}
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
        {confirm?.decision === 'approved' && (
          <dl className="blox-kv blox-kv--two">
            <dt>{t('dealerOps.settlement.principalOutstanding')}</dt>
            <dd className="blox-kv__num">{qar(confirm.row.remaining_principal)}</dd>
            <dt>{t('dealerOps.settlement.accruedProfit')}</dt>
            <dd className="blox-kv__num">{qar(confirm.row.accrued_profit)}</dd>
            <dt>{t('dealerOps.settlement.forgivenRent')}</dt>
            <dd className="blox-kv__num">{qar(confirm.row.forgiven_rent)}</dd>
            <dt>{t('dealerOps.settlement.savings')}</dt>
            <dd className="blox-kv__num">{qar(confirm.row.savings)}</dd>
          </dl>
        )}
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
