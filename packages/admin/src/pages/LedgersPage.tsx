import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ConfirmDialog,
  OpsDataTable,
  OpsEmptyState,
  OpsListPage,
  OpsStatusPill,
  OpsToolbar,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  scheduleOpsPillVariant,
  useOpsLabels,
} from '@drivemarket/shared';

type ScheduleRow = {
  id: string;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  sequence: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  effective_status: string;
  payment_reference: string | null;
  pending_waive_reason?: string | null;
  pending_waive_requested_by_id?: string | null;
};

const PAY_METHODS = ['bank_transfer', 'card', 'cash', 'cheque'] as const;

/** Real installment ledger with record-payment actions for admin. */
export function LedgersPage() {
  const { t, scheduleStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [payTarget, setPayTarget] = useState<ScheduleRow | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<string>('bank_transfer');
  const [payReference, setPayReference] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [status]);

  const { data, error } = useQuery({
    queryKey: ['admin-schedules', status, page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: ScheduleRow[];
      }>(`/api/ops/payment-schedules?${buildPaginationQuery(page)}${status ? `&status=${status}` : ''}`),
  });

  const pay = useMutation({
    mutationFn: (payload: { id: string; method: string; reference: string; amount: number }) =>
      apiFetch(`/api/ops/payment-schedules/${payload.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          method: payload.method,
          reference: payload.reference || undefined,
          amount: payload.amount,
        }),
      }),
    onSuccess: () => {
      setPayTarget(null);
      setPayReference('');
      setPayAmount(0);
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin-schedules'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  return (
    <OpsListPage
      title="Installments"
      subtitle={`Installment ledger across active financings${data ? ` — ${data.total} rows` : ''}`}
      error={
        <>
          {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
          {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
        </>
      }
      toolbar={
        <OpsToolbar
          filters={
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">{t('ops.finance.allStatuses')}</option>
              <option value="pending">{t('ops.scheduleStatus.pending')}</option>
              <option value="overdue">{t('ops.scheduleStatus.overdue')}</option>
              <option value="paid">{t('ops.scheduleStatus.paid')}</option>
              <option value="waived">{t('ops.scheduleStatus.waived')}</option>
            </select>
          }
        />
      }
    >
      <OpsDataTable
        columns={['Customer', 'Vehicle', 'Dealer', 'Seq', 'Due', 'Amount', 'Remaining', 'Status', '']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={
          <OpsEmptyState
            title="No installments"
            body="Schedules appear once financings are activated."
          />
        }
        rows={(data?.items ?? []).map((r) => [
          <span key="c" title={r.customer_email}>{r.customer_name ?? r.customer_email}</span>,
          r.vehicle,
          r.company_name,
          String(r.sequence),
          r.due_date,
          <span key="a" className="blox-money">QAR {r.amount.toLocaleString()}</span>,
          <span key="r" className="blox-money">QAR {r.remaining_amount.toLocaleString()}</span>,
          <OpsStatusPill key="s" label={scheduleStatus(r.effective_status)} variant={scheduleOpsPillVariant(r.effective_status)} />,
          r.effective_status === 'pending' || r.effective_status === 'overdue' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              onClick={() => {
                setActionError(null);
                setPayTarget(r);
                setPayAmount(r.remaining_amount);
                setPayReference('');
                setPayMethod('bank_transfer');
              }}
            >
              {t('ops.finance.recordPayment')}
            </button>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.payment_reference ?? '—'}</span>
          ),
        ])}
      />
      {payTarget && (
        <div className="blox-panel" style={{ marginTop: 16, padding: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>
            {t('ops.finance.recordPaymentTitle', {
              seq: payTarget.sequence,
              amount: payTarget.remaining_amount.toLocaleString(),
            })}
          </h3>
          <p style={{ fontSize: '0.8125rem', margin: '4px 0 12px' }}>
            {payTarget.customer_name ?? payTarget.customer_email} · {payTarget.vehicle}
          </p>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
            {t('ops.finance.paymentAmount')}
            <input
              type="number"
              min={0.01}
              max={payTarget.remaining_amount}
              step={0.01}
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
            {t('ops.finance.method')}
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`ops.finance.methodOption.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 14 }}>
            {t('ops.finance.reference')}
            <input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              placeholder={t('ops.finance.referencePlaceholder')}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={pay.isPending || payAmount <= 0 || payAmount > payTarget.remaining_amount}
              onClick={() => setPayConfirmOpen(true)}
            >
              {pay.isPending ? t('ops.finance.recording') : t('ops.finance.confirmPayment')}
            </button>
            <button type="button" className="blox-btn blox-btn--ghost" onClick={() => setPayTarget(null)}>
              {t('ops.common.cancel')}
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={payConfirmOpen && !!payTarget}
        title={t('ops.finance.confirmPayment')}
        message={
          payTarget
            ? t('ops.finance.confirmPaymentPrompt', {
                amount: payAmount.toLocaleString(),
                seq: payTarget.sequence,
              })
            : ''
        }
        onCancel={() => setPayConfirmOpen(false)}
        onConfirm={() => {
          if (payTarget) {
            pay.mutate({ id: payTarget.id, method: payMethod, reference: payReference, amount: payAmount });
          }
          setPayConfirmOpen(false);
        }}
      />
    </OpsListPage>
  );
}
