import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Doughnut } from 'react-chartjs-2';
import {
  apiFetch,
  bloxTokens,
  ChartLegendItem,
  ChartPanel,
  DashboardPipelineSection,
  DashboardGrid,
  doughnutChartOptions,
  formatQar,
  LineChart,
  OpsContentCard,
  OpsDashboardPage,
  OpsDataTable,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsSecondaryButton,
  VerticalBarChart,
  useOpsLabels,
} from '@drivemarket/shared';

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
  const dash = (value: number | undefined) => String(value ?? '—');
  const dueThisWeek = data?.upcoming_due?.length ?? 0;
  const dueThisWeekAmount = (data?.upcoming_due ?? []).reduce((sum, row) => sum + row.amount, 0);
  const totalSchedules = status.pending + status.overdue + status.paid;

  return (
    <OpsDashboardPage
      title={t('ops.finance.dashboardTitle')}
      subtitle={t('ops.finance.dashboardSubtitle')}
      headerActions={
        <Link to="/schedules" className="blox-link-reset">
          <OpsPrimaryButton>{t('ops.finance.nav.schedules')}</OpsPrimaryButton>
        </Link>
      }
      error={error ? (error as Error).message : undefined}
      heroIndex={1}
      metrics={[
        { label: t('ops.dashboard.pendingSchedules'), value: dash(data?.schedules_pending) },
        {
          label: t('ops.admin.overdue'),
          value: dash(data?.schedules_overdue),
          trend: data?.overdue_trend.map((w) => w.count),
          deltaTone: data && data.schedules_overdue > 0 ? 'down' : 'up',
          delta: data ? (data.schedules_overdue > 0 ? t('ops.dashboard.needsCollection') : t('ops.dashboard.allCurrent')) : undefined,
        },
        { label: t('ops.dashboard.paidSchedules'), value: dash(data?.schedules_paid) },
        {
          label: t('ops.dashboard.collectedMonth'),
          value: data ? formatQar(data.collected_this_month) : '—',
          trend: data?.collections_by_week.map((w) => w.amount),
          deltaTone: 'up',
          delta: data ? t('ops.dashboard.lastWeeks', { count: data.collections_by_week.length }) : undefined,
        },
        {
          label: t('ops.dashboard.pendingTransfers'),
          value: dash(data?.pending_bank_transfers),
          deltaTone: data && data.pending_bank_transfers > 0 ? 'neutral' : 'up',
          delta: data && data.pending_bank_transfers > 0 ? t('ops.dashboard.awaitingConfirmation') : undefined,
        },
        { label: t('ops.dashboard.activeFinancings'), value: dash(data?.active_financings) },
        {
          label: t('ops.dashboard.dueThisWeek'),
          value: dash(dueThisWeek),
          delta: dueThisWeek > 0 ? formatQar(dueThisWeekAmount) : undefined,
        },
      ]}
    >
      <DashboardPipelineSection
        title={t('ops.dashboard.scheduleStatus')}
        subtitle={t('ops.dashboard.pipelineSnapshot')}
        stats={[
          { label: t('ops.scheduleStatus.pending'), value: dash(status.pending), tone: 'info' },
          { label: t('ops.scheduleStatus.overdue'), value: dash(status.overdue), tone: 'danger' },
          { label: t('ops.scheduleStatus.paid'), value: dash(status.paid), tone: 'success' },
          {
            label: t('ops.dashboard.pendingInstallments'),
            value: dash(totalSchedules),
            delta: data ? `${Math.round((status.paid / Math.max(totalSchedules, 1)) * 100)}% paid` : undefined,
            tone: 'neutral',
          },
        ]}
        columns={4}
      />
      <DashboardGrid>
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
          <div className="blox-chart-donut">
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
      </DashboardGrid>

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

      <OpsContentCard staticHover className="blox-dashboard-section">
        <h2 className="blox-panel__title">{t('ops.dashboard.upcomingDue')}</h2>
        {(data?.upcoming_due?.length ?? 0) === 0 ? (
          <p className="blox-muted">{t('ops.dashboard.allCurrent')}</p>
        ) : (
          <OpsDataTable
            columns={['Application', 'Installment', 'Due', 'Amount', '']}
            numericColumns={[3]}
            rows={(data?.upcoming_due ?? []).map((row) => [
              row.application_id.slice(0, 8),
              `#${row.sequence}`,
              row.due_date,
              formatQar(row.amount),
              <Link key={row.id} to={`/applications/${row.application_id}`} className="blox-link-reset">
                <OpsGhostButton>{t('ops.dashboard.open')}</OpsGhostButton>
              </Link>,
            ])}
          />
        )}
      </OpsContentCard>

      <OpsContentCard staticHover className="blox-dashboard-section">
        <h2 className="blox-panel__title">{t('ops.dashboard.quickLinks')}</h2>
        <div className="blox-stack">
          <Link to="/schedules" className="blox-link-reset">
            <OpsPrimaryButton>{t('ops.finance.nav.schedules')}</OpsPrimaryButton>
          </Link>
          <Link to="/applications" className="blox-link-reset">
            <OpsSecondaryButton>{t('ops.finance.nav.applications')}</OpsSecondaryButton>
          </Link>
          <Link to="/exports" className="blox-link-reset">
            <OpsGhostButton>{t('ops.finance.nav.exports')}</OpsGhostButton>
          </Link>
        </div>
      </OpsContentCard>
    </OpsDashboardPage>
  );
}
