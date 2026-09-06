import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch, buildPaginationQuery, DEFAULT_PAGE_SIZE, paginationWindow } from '../lib/api';
import { scheduleOpsPillVariant } from '../config/status-styles';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../components/ops-ui';
import { chartColorAt } from '../config/chart-palette';
import {
  FilterPanel,
  OpsListPage,
  OpsToolbar,
  Table,
  VerticalBarChart,
  type Column,
  type FilterConfig,
} from '../ops-ui-v2';
import type { ScheduleListResponse } from '../types/domain';
import { RecordPaymentDialog } from './RecordPaymentDialog';

type ScheduleRow = {
  id: string;
  application_id: string;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  sequence: number;
  due_date: string;
  amount: number;
  remaining_amount: number;
  effective_status: string;
  payment_reference: string | null;
};

export function ScheduleLedger() {
  const { t, scheduleStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [payTarget, setPayTarget] = useState<ScheduleRow | null>(null);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const { data, error, isLoading } = useQuery({
    queryKey: ['schedules', statusFilter, page],
    queryFn: () =>
      apiFetch<ScheduleListResponse<ScheduleRow>>(
        `/api/ops/payment-schedules?${buildPaginationQuery(page)}${statusFilter ? `&status=${statusFilter}` : ''}`,
      ),
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
      toast.success('Payment recorded');
      void qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sweep = useMutation({
    mutationFn: () => apiFetch('/api/ops/payment-schedules/mark-overdue', { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toast.success('Overdue sweep complete');
      void qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const summary = data?.summary;
  const { total } = paginationWindow(data?.total ?? 0, page);

  const columns: Column<ScheduleRow>[] = useMemo(
    () => [
      {
        id: 'customer',
        cardTitle: true,
        label: t('ops.col.customer'),
        format: (_, r) => r.customer_name ?? r.customer_email,
      },
      { id: 'vehicle', label: t('ops.col.vehicle'), format: (_, r) => r.vehicle },
      { id: 'sequence', label: t('ops.col.seq'), format: (_, r) => `${r.sequence}` },
      { id: 'due_date', label: t('ops.col.due'), format: (_, r) => r.due_date },
      {
        id: 'amount',
        sortable: true,
        numeric: true,
        label: t('ops.col.amount'),
        format: (_, r) => <span className="blox-money">QAR {r.amount.toLocaleString()}</span>,
      },
      {
        id: 'remaining_amount',
        numeric: true,
        label: t('ops.col.remaining'),
        format: (_, r) => <span className="blox-money">QAR {r.remaining_amount.toLocaleString()}</span>,
      },
      {
        id: 'effective_status',
        sortable: true,
        cardStatus: true,
        label: t('ops.col.status'),
        format: (_, r) => (
          <OpsStatusPill label={scheduleStatus(r.effective_status)} variant={scheduleOpsPillVariant(r.effective_status)} />
        ),
      },
      {
        id: 'actions',
        actions: true,
        label: '',
        format: (_, r) =>
          r.effective_status === 'pending' || r.effective_status === 'overdue' ? (
            <OpsPrimaryButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPayTarget(r);
              }}
            >
              {t('ops.finance.recordPayment')}
            </OpsPrimaryButton>
          ) : (
            r.payment_reference ?? ''
          ),
      },
    ],
    [t, scheduleStatus],
  );

  return (
    <OpsListPage
      title={t('ops.finance.schedulesTitle')}
      subtitle={t('ops.finance.schedulesSubtitle')}
      headerActions={
        <OpsSecondaryButton type="button" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
          {sweep.isPending ? t('ops.finance.sweeping') : t('ops.finance.runOverdueSweep')}
        </OpsSecondaryButton>
      }
      error={error ? (error as Error).message : undefined}
      metrics={[
        { label: t('ops.finance.pending'), value: String(summary?.pending ?? '—') },
        { label: t('ops.scheduleStatus.overdue'), value: String(summary?.overdue ?? '—') },
        { label: t('ops.finance.paid'), value: String(summary?.paid ?? '—') },
      ]}
      toolbar={
        <OpsToolbar
          filters={
            <FilterPanel
              title={t('ops.finance.allStatuses')}
              filters={[
                {
                  id: 'status',
                  label: t('ops.finance.allStatuses'),
                  type: 'select',
                  options: [
                    { value: 'pending', label: t('ops.scheduleStatus.pending') },
                    { value: 'overdue', label: t('ops.scheduleStatus.overdue') },
                    { value: 'paid', label: t('ops.scheduleStatus.paid') },
                    { value: 'waived', label: t('ops.scheduleStatus.waived') },
                  ],
                },
              ] satisfies FilterConfig[]}
              values={{ status: statusFilter }}
              onChange={(next) => setStatusFilter(String(next.status ?? ''))}
              onClear={() => setStatusFilter('')}
            />
          }
        />
      }
    >
      {summary && (
        <section className="blox-panel blox-dashboard-section">
          <VerticalBarChart
            bars={[
              { label: t('ops.finance.pending'), value: summary.pending ?? 0, color: chartColorAt(0) },
              { label: t('ops.scheduleStatus.overdue'), value: summary.overdue ?? 0, color: chartColorAt(3) },
              { label: t('ops.finance.paid'), value: summary.paid ?? 0, color: chartColorAt(1) },
            ]}
          />
        </section>
      )}
      <Table
        columns={columns}
        rows={items}
        loading={isLoading}
        page={page}
        rowsPerPage={DEFAULT_PAGE_SIZE}
        totalRows={total}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.noSchedules')}
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
