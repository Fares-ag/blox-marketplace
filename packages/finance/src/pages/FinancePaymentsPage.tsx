import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetch,
  OpsCoreTable,
  OpsListPage,
  OpsTab,
  OpsTabs,
  OpsToolbar,
  PendingBankTransfers,
  ScheduleLedger,
  useOpsLabels,
  type OpsTableColumn,
} from '@drivemarket/shared';

type PaymentsTab = 'schedules' | 'transactions' | 'bank';

export type TransactionRow = {
  id: string;
  application_id: string;
  gateway: string;
  gateway_payment_id: string | null;
  amount: number;
  currency: string;
  status: string;
  sequence: number | null;
  due_date: string | null;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  created_at: string;
};

const PAGE = 50;

function TransactionsTable() {
  const { t } = useOpsLabels();
  const [page, setPage] = useState(0);
  const { data, error, isLoading } = useQuery({
    queryKey: ['finance-transactions', page],
    queryFn: () =>
      apiFetch<{ total: number; items: TransactionRow[] }>(
        `/api/ops/payment-transactions?limit=${PAGE}&offset=${page * PAGE}`,
      ),
  });
  const columns: OpsTableColumn<TransactionRow>[] = useMemo(
    () => [
      { id: 'created_at', label: t('ops.col.created'), format: (_, r) => r.created_at.slice(0, 16).replace('T', ' ') },
      {
        id: 'customer',
        label: t('ops.col.customer'),
        format: (_, r) => (
          <Link to={`/applications/${r.application_id}`}>{r.customer_name ?? r.customer_email}</Link>
        ),
      },
      { id: 'vehicle', label: t('ops.col.vehicle'), format: (_, r) => r.vehicle },
      { id: 'gateway', label: t('ops.finance.gateway'), format: (_, r) => r.gateway },
      {
        id: 'amount',
        label: t('ops.col.amount'),
        format: (_, r) => `${r.currency} ${r.amount.toLocaleString()}`,
      },
      { id: 'sequence', label: t('ops.col.seq'), format: (_, r) => (r.sequence != null ? String(r.sequence) : '—') },
      { id: 'status', label: t('ops.col.status'), format: (_, r) => r.status },
    ],
    [t],
  );
  return (
    <>
      {error && <p className="blox-form-error" role="alert">{(error as Error).message}</p>}
      <OpsCoreTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        page={page}
        rowsPerPage={PAGE}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.transactionsEmpty')}
      />
    </>
  );
}

/** blox-vercel `/finance/payments` — Schedules + Transactions (+ marketplace bank transfers). */
export function FinancePaymentsPage() {
  const { t } = useOpsLabels();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as PaymentsTab | null) ?? 'schedules';

  if (tab === 'schedules') {
    // ScheduleLedger renders its own OpsListPage (title, metrics, filters, record payment).
    return (
      <>
        <PaymentsTabs tab={tab} onChange={(next) => setParams({ tab: next })} />
        <ScheduleLedger />
      </>
    );
  }
  if (tab === 'bank') {
    return (
      <>
        <PaymentsTabs tab={tab} onChange={(next) => setParams({ tab: next })} />
        <PendingBankTransfers />
      </>
    );
  }
  return (
    <OpsListPage
      title={t('ops.finance.paymentsTitle')}
      subtitle={t('ops.finance.paymentsSubtitle')}
      toolbar={<OpsToolbar tabs={<PaymentsTabs tab={tab} onChange={(next) => setParams({ tab: next })} />} />}
    >
      <TransactionsTable />
    </OpsListPage>
  );
}

function PaymentsTabs({ tab, onChange }: { tab: PaymentsTab; onChange: (next: PaymentsTab) => void }) {
  const { t } = useOpsLabels();
  return (
    <OpsTabs value={tab} onChange={(_, next) => onChange(next as PaymentsTab)}>
      <OpsTab value="schedules" label={t('ops.finance.tabSchedules')} />
      <OpsTab value="transactions" label={t('ops.finance.tabTransactions')} />
      <OpsTab value="bank" label={t('ops.finance.tabBankTransfers')} />
    </OpsTabs>
  );
}
