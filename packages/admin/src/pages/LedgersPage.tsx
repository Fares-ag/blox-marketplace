import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetch,
  OpsEmptyState,
  buildPaginationQuery,
  paginationWindow,
  scheduleOpsPillVariant,
} from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill } from '../components/ui';

/** Real installment ledger (replaces the former mocked transactions view). */
export function LedgersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [status]);
  const { data, error } = useQuery({
    queryKey: ['admin-schedules', status, page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          customer_name: string | null;
          customer_email: string;
          vehicle: string;
          company_name: string;
          sequence: number;
          due_date: string;
          amount: number;
          paid_amount: number;
          status: string;
          effective_status: string;
          payment_reference: string | null;
        }>;
      }>(`/api/ops/payment-schedules?${buildPaginationQuery(page)}${status ? `&status=${status}` : ''}`),
  });
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  return (
    <div className="blox-page">
      <PageHeader
        title="Installments"
        subtitle={`Installment ledger across active financings${data ? ` — ${data.total} rows` : ''}`}
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <div className="blox-filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </select>
      </div>
      <DataTable
        columns={['Customer', 'Vehicle', 'Dealer', 'Seq', 'Due', 'Amount', 'Status', 'Reference']}
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
          <StatusPill key="s" label={r.effective_status} variant={scheduleOpsPillVariant(r.effective_status)} />,
          r.payment_reference ?? '—',
        ])}
      />
    </div>
  );
}
