import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetch,
  OpsCoreTable,
  OpsListPage,
  OpsToolbar,
  SearchBar,
  useOpsLabels,
  type OpsTableColumn,
} from '@drivemarket/shared';

export type BookRow = {
  application_id: string;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  activated_at: string | null;
  remaining_principal: number;
  installments_total: number;
  installments_paid: number;
  installments_overdue: number;
  next_due_date: string | null;
  next_amount: number | null;
  next_sequence: number | null;
};

export type BookResponse = {
  total: number;
  limit: number;
  offset: number;
  summary: { active: number; remaining_principal: number };
  items: BookRow[];
};

const PAGE = 50;

/** blox-vercel `/finance/book` — one row per active financing. */
export function FinanceBookPage() {
  const { t } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');

  const { data, error, isLoading } = useQuery({
    queryKey: ['finance-book', page, q],
    queryFn: () =>
      apiFetch<BookResponse>(
        `/api/ops/finance/book?limit=${PAGE}&offset=${page * PAGE}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });
  const items = data?.items ?? [];

  const columns: OpsTableColumn<BookRow>[] = useMemo(
    () => [
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
        id: 'next',
        label: t('ops.finance.nextInstallment'),
        format: (_, r) =>
          r.next_due_date ? `#${r.next_sequence} · ${r.next_due_date} · QAR ${(r.next_amount ?? 0).toLocaleString()}` : '—',
      },
      {
        id: 'progress',
        label: t('ops.finance.installmentsPaid'),
        format: (_, r) => `${r.installments_paid} / ${r.installments_total}`,
      },
      { id: 'overdue', label: t('ops.finance.overdueCount'), format: (_, r) => String(r.installments_overdue) },
      {
        id: 'activated_at',
        label: t('ops.finance.activatedAt'),
        format: (_, r) => (r.activated_at ? r.activated_at.slice(0, 10) : '—'),
      },
    ],
    [t],
  );

  return (
    <OpsListPage
      title={t('ops.finance.bookTitle')}
      subtitle={t('ops.finance.bookSubtitle')}
      metrics={[
        { label: t('ops.finance.activeFinancings'), value: String(data?.summary.active ?? '—') },
        {
          label: t('ops.finance.remainingPrincipal'),
          value: data ? `QAR ${data.summary.remaining_principal.toLocaleString()}` : '—',
        },
      ]}
      error={error ? (error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(0);
              }}
              placeholder={t('ops.common.search')}
            />
          }
        />
      }
    >
      <OpsCoreTable
        columns={columns}
        rows={items}
        loading={isLoading}
        page={page}
        rowsPerPage={PAGE}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.bookEmpty')}
      />
    </OpsListPage>
  );
}
