import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, OpsEmptyState } from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill, type PillVariant } from '../components/ui';

function scheduleVariant(status: string): PillVariant {
  if (status === 'paid') return 'approved';
  if (status === 'overdue') return 'rejected';
  if (status === 'waived') return 'draft';
  return 'pending';
}

/** Real installment ledger (replaces the former mocked transactions view). */
export function LedgersPage() {
  const [status, setStatus] = useState('');
  const { data, error } = useQuery({
    queryKey: ['admin-schedules', status],
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
      }>(`/api/ops/payment-schedules?limit=100${status ? `&status=${status}` : ''}`),
  });

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
          <StatusPill key="s" label={r.effective_status} variant={scheduleVariant(r.effective_status)} />,
          r.payment_reference ?? '—',
        ])}
      />
    </div>
  );
}
