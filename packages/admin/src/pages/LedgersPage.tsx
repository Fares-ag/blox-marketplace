import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  OpsDataTable,
  OpsEmptyState,
  OpsListPage,
  OpsStatusPill,
  OpsToolbar,
  RecordPaymentDialog,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  scheduleOpsPillVariant,
  useOpsLabels,
  type RecordPaymentTarget,
} from '@drivemarket/shared';

type ScheduleRow = RecordPaymentTarget & {
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
  effective_status: string;
  payment_reference: string | null;
};

/** Real installment ledger with record-payment actions for admin. */
export function LedgersPage() {
  const { t, scheduleStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [payTarget, setPayTarget] = useState<ScheduleRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      setActionError(null);
      toast.success(t('ops.finance.paymentRecorded', { defaultValue: 'Payment recorded' }));
      void qc.invalidateQueries({ queryKey: ['admin-schedules'] });
    },
    onError: (e) => {
      const msg = (e as Error).message;
      setActionError(msg);
      toast.error(msg);
    },
  });

  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  return (
    <OpsListPage
      title="Installments"
      subtitle={`Installment ledger across active financings${data ? ` — ${data.total} rows` : ''}`}
      error={
        <>
          {error && <p className="blox-form-error" role="alert">{(error as Error).message}</p>}
          {actionError && <p className="blox-form-error" role="alert">{actionError}</p>}
        </>
      }
      toolbar={
        <OpsToolbar
          filters={
            <select
              className="blox-toolbar-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
            >
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
              }}
            >
              {t('ops.finance.recordPayment')}
            </button>
          ) : (
            <span key="b" className="blox-table__id">{r.payment_reference ?? '—'}</span>
          ),
        ])}
      />
      <RecordPaymentDialog
        target={payTarget}
        busy={pay.isPending}
        onClose={() => setPayTarget(null)}
        onConfirm={({ method, reference, amount }) => {
          if (!payTarget) return;
          pay.mutate({ id: payTarget.id, method, reference, amount });
        }}
      />
    </OpsListPage>
  );
}
