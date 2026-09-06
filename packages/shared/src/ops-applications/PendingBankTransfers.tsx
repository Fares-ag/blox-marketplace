import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildPaginationQuery, DEFAULT_PAGE_SIZE, paginationWindow } from '../lib/api';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { ConfirmDialog, OpsListPage, Table, type Column } from '../ops-ui-v2';
import type { PaginatedResponse } from '../types/domain';

type PendingBankRow = {
  id: string;
  application_id: string;
  amount: number;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  sequence: number | null;
  created_at: string;
};

export function PendingBankTransfers() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<PendingBankRow | null>(null);
  const { data, error: loadError, isLoading } = useQuery({
    queryKey: ['pending-bank', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<PendingBankRow>>(`/api/ops/payments/pending-bank?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { total } = paginationWindow(data?.total ?? 0, page);
  const confirm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/ops/payments/${id}/confirm-bank`, { method: 'POST' }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['pending-bank'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const columns: Column<PendingBankRow>[] = useMemo(
    () => [
      {
        id: 'customer',
        cardTitle: true,
        label: t('ops.col.customer'),
        format: (_, row) => row.customer_name ?? row.customer_email,
      },
      { id: 'vehicle', label: t('ops.col.vehicle'), format: (_, row) => row.vehicle },
      { id: 'company_name', label: t('ops.col.dealer'), format: (_, row) => row.company_name },
      {
        id: 'amount',
        sortable: true,
        numeric: true,
        label: t('ops.col.amount'),
        format: (_, row) => `QAR ${row.amount.toLocaleString()}`,
      },
      {
        id: 'sequence',
        numeric: true,
        label: t('ops.col.seq'),
        format: (_, row) => (row.sequence != null ? String(row.sequence) : '—'),
      },
      {
        id: 'actions',
        actions: true,
        label: '',
        format: (_, row) => (
          <button
            type="button"
            className="blox-btn blox-btn--primary"
            disabled={confirm.isPending}
            onClick={() => setConfirmRow(row)}
          >
            {t('ops.finance.confirmTransfer')}
          </button>
        ),
      },
    ],
    [t, confirm.isPending],
  );

  return (
    <OpsListPage
      title={t('ops.finance.bankTitle')}
      subtitle={t('ops.finance.bankSubtitle')}
      error={(loadError as Error | null)?.message ?? error ?? undefined}
    >
      <Table
        columns={columns}
        rows={items}
        loading={isLoading}
        page={page}
        rowsPerPage={DEFAULT_PAGE_SIZE}
        totalRows={total}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.bankEmpty')}
      />
      <ConfirmDialog
        open={!!confirmRow}
        title={t('ops.finance.confirmTransfer')}
        message={confirmRow ? t('ops.finance.confirmBank', { amount: confirmRow.amount.toLocaleString() }) : ''}
        onCancel={() => setConfirmRow(null)}
        onConfirm={() => {
          if (confirmRow) confirm.mutate(confirmRow.id);
          setConfirmRow(null);
        }}
      />
    </OpsListPage>
  );
}
