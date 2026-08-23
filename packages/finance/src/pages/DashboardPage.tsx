import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  apiFetch,
  bloxTokens,
  ChartLegendItem,
  ChartPanel,
  doughnutChartOptions,
  formatQar,
  LineChart,
  OpsContentCard,
  OpsDashboardPage,
  OpsDataTable,
  OpsGhostButton,
  OpsPrimaryButton,
  VerticalBarChart,
  useOpsLabels,
} from '@drivemarket/shared';

ChartJS.register(ArcElement, Tooltip, Legend);

type FinanceMetrics = {
  schedules_pending: number;
  schedules_overdue: number;
  schedules_paid: number;
  pending_bank_transfers: number;
  active_financings: number;
  collected_this_month: number;
  schedule_status: { pending: number; overdue: number; paid: number };
  collections_by_week: Array<{ label: string; count: number; amount: number }>;
  overdue_trend: Array<{ label: string; count: number }>;
  upcoming_due: Array<{
    id: string;
    application_id: string;
    sequence: number;
    due_date: string;
    amount: number;
  }>;
};

export function DashboardPage() {
  const { t } = useOpsLabels();
  const { data, error } = useQuery({
    queryKey: ['finance-metrics'],
    queryFn: () => apiFetch<FinanceMetrics>('/api/ops/metrics/finance'),
  });

  const status = data?.schedule_status ?? { pending: 0, overdue: 0, paid: 0 };

  return (
    <OpsDashboardPage
      title={t('ops.finance.dashboardTitle')}
      subtitle={t('ops.finance.dashboardSubtitle')}
      headerActions={
        <Link to="/schedules" style={{ textDecoration: 'none' }}>
          <OpsPrimaryButton>{t('ops.finance.nav.schedules')}</OpsPrimaryButton>
        </Link>
      }
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      heroIndex={1}
      metrics={[
        { label: t('ops.dashboard.pendingSchedules'), value: String(data?.schedules_pending ?? '—') },
        { label: t('ops.admin.overdue'), value: String(data?.schedules_overdue ?? '—') },
        {
          label: t('ops.dashboard.collectedMonth'),
          value: data ? formatQar(data.collected_this_month) : '—',
        },
        { label: t('ops.dashboard.pendingTransfers'), value: String(data?.pending_bank_transfers ?? '—') },
        { label: t('ops.dashboard.activeFinancings'), value: String(data?.active_financings ?? '—') },
      ]}
    >
      <div className="blox-chart-row blox-dashboard-section">
        <ChartPanel
          title={t('ops.dashboard.scheduleStatus')}
          legend={
            <>
              <ChartLegendItem color={bloxTokens.emerald} label={`Pending — ${status.pending}`} />
              <ChartLegendItem color={bloxTokens.slate} label={`Overdue — ${status.overdue}`} />
              <ChartLegendItem color={bloxTokens.deepGreen} label={`Paid — ${status.paid}`} />
            </>
          }
        >
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <Doughnut
              data={{
                labels: ['Pending', 'Overdue', 'Paid'],
                datasets: [
                  {
                    data: [status.pending, status.overdue, status.paid],
                    backgroundColor: [bloxTokens.emerald, bloxTokens.slate, bloxTokens.deepGreen],
                    borderWidth: 0,
                  },
                ],
              }}
              options={doughnutChartOptions}
            />
          </div>
        </ChartPanel>

        <ChartPanel title={t('ops.dashboard.overdueTrend')}>
          <LineChart
            labels={(data?.overdue_trend ?? []).map((w) => w.label)}
            series={[
              {
                label: t('ops.admin.overdue'),
                data: (data?.overdue_trend ?? []).map((w) => w.count),
                color: bloxTokens.slate,
              },
            ]}
          />
        </ChartPanel>
      </div>

      <div className="blox-dashboard-section">
        <ChartPanel title={t('ops.dashboard.collectionsByWeek')}>
          <VerticalBarChart
            bars={(data?.collections_by_week ?? []).map((w, i) => ({
              label: w.label,
              value: w.count,
              color: i % 2 === 0 ? bloxTokens.emerald : bloxTokens.deepGreen,
            }))}
          />
        </ChartPanel>
      </div>

      {(data?.upcoming_due?.length ?? 0) > 0 && (
        <OpsContentCard staticHover className="blox-dashboard-section">
          <h2 className="blox-panel__title">{t('ops.dashboard.upcomingDue')}</h2>
          <OpsDataTable
            columns={['Application', 'Installment', 'Due', 'Amount', '']}
            numericColumns={[3]}
            rows={(data?.upcoming_due ?? []).map((row) => [
              row.application_id.slice(0, 8),
              `#${row.sequence}`,
              row.due_date,
              formatQar(row.amount),
              <Link key={row.id} to={`/applications/${row.application_id}`} style={{ textDecoration: 'none' }}>
                <OpsGhostButton>{t('ops.dashboard.open')}</OpsGhostButton>
              </Link>,
            ])}
          />
        </OpsContentCard>
      )}
    </OpsDashboardPage>
  );
}
