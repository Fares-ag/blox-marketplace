import { useQuery } from '@tanstack/react-query';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  apiFetch,
  bloxTokens,
  ChartLegendItem,
  ChartPanel,
  doughnutChartOptions,
  ExportButton,
  FunnelChart,
  HorizontalBarChart,
  LineChart,
  OpsContentCard,
  OpsDashboardPage,
  OpsDataTable,
  SecuritySettingsPanel,
  useOpsLabels,
  VerticalBarChart,
} from '@drivemarket/shared';

ChartJS.register(ArcElement, Tooltip, Legend);

type Metrics = {
  users_total: number;
  customers_total: number;
  companies_active: number;
  products_published: number;
  applications_by_status: Record<string, number>;
  schedules_pending: number;
  schedules_overdue: number;
  applications_this_month: number;
  new_customers_30d: number;
  top_dealers_by_apps: Array<{ company_id: string; company_name: string; count: number }>;
  submissions_by_week: Array<{ label: string; count: number }>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    actor_email: string | null;
    created_at: string;
  }>;
  funnel?: {
    draft: number;
    under_review: number;
    active: number;
    completed: number;
    rejected: number;
  };
  conversion_rate?: number;
};

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const { data, error } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiFetch<Metrics>('/api/ops/metrics'),
  });
  const { data: revenue } = useQuery({
    queryKey: ['admin-revenue-forecast'],
    queryFn: () =>
      apiFetch<{ projected_revenue: number; real_revenue: number }>(
        '/api/ops/analytics/revenue-forecast',
      ),
  });
  const { data: collection } = useQuery({
    queryKey: ['admin-collection-rates'],
    queryFn: () =>
      apiFetch<{ paid: number; pending: number; overdue: number; collection_rate: number }>(
        '/api/ops/analytics/payment-collection-rates',
      ),
  });

  const byStatus = data?.applications_by_status ?? {};
  const active = byStatus.active ?? 0;
  const completed = byStatus.completed ?? 0;
  const inReview =
    (byStatus.under_review ?? 0) +
    (byStatus.resubmission_required ?? 0) +
    (byStatus.contracts_submitted ?? 0) +
    (byStatus.contract_under_review ?? 0);
  const settledOrOnTrack = data ? data.schedules_pending : 0;
  const overdue = data?.schedules_overdue ?? 0;
  const funnel = data?.funnel;
  const funnelTotal = funnel
    ? funnel.draft + funnel.under_review + funnel.active + funnel.completed + funnel.rejected
    : 0;

  const chartData = {
    labels: [t('ops.admin.pendingOnSchedule'), t('ops.admin.overdue')],
    datasets: [
      {
        data: [settledOrOnTrack, overdue],
        backgroundColor: [bloxTokens.emerald, bloxTokens.slate],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const statusBars = Object.entries(byStatus)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count], index) => ({
      label: applicationStatus(status),
      value: count,
      color: index === 0 ? bloxTokens.emerald : bloxTokens.deepGreen,
    }));

  const topDealers = data?.top_dealers_by_apps ?? [];
  const maxDealer = Math.max(...topDealers.map((d) => d.count), 1);

  return (
    <OpsDashboardPage
      title={t('ops.admin.dashboardTitle')}
      subtitle={t('ops.admin.dashboardSubtitle')}
      headerActions={
        <ExportButton
          data={[
            { metric: 'customers', value: data?.customers_total ?? 0 },
            { metric: 'dealers', value: data?.companies_active ?? 0 },
            { metric: 'vehicles', value: data?.products_published ?? 0 },
            { metric: 'conversion_rate', value: data?.conversion_rate ?? 0 },
            ...Object.entries(byStatus).map(([status, count]) => ({ metric: status, value: count })),
          ]}
          filename="admin-dashboard"
        />
      }
      error={error ? (error as Error).message : undefined}
      metrics={[
        {
          label: t('ops.admin.customers'),
          value: String(data?.customers_total ?? '—'),
          delta: t('ops.admin.totalUsers', { count: data?.users_total ?? 0 }),
        },
        { label: t('ops.admin.activeDealers'), value: String(data?.companies_active ?? '—') },
        { label: t('ops.admin.publishedVehicles'), value: String(data?.products_published ?? '—') },
        {
          label: t('ops.admin.appsInReview'),
          value: String(inReview),
          delta: t('ops.admin.activeCompleted', { active, completed }),
        },
        {
          label: t('ops.dashboard.appsThisMonth'),
          value: String(data?.applications_this_month ?? '—'),
          delta: `${data?.new_customers_30d ?? 0} new customers (30d)`,
          deltaTone: 'up',
          trend: data?.submissions_by_week?.map((w: { count: number }) => w.count),
        },
        {
          label: 'Projected revenue',
          value: revenue ? `QAR ${revenue.projected_revenue.toLocaleString()}` : '—',
          delta: revenue ? `Real: QAR ${revenue.real_revenue.toLocaleString()}` : undefined,
        },
        {
          label: 'Collection rate',
          value: collection ? `${Math.round(collection.collection_rate * 100)}%` : '—',
          delta: collection
            ? `${collection.paid} paid · ${collection.overdue} overdue`
            : undefined,
        },
      ]}
    >
      <div className="blox-chart-row blox-dashboard-section">
        <ChartPanel
          title={t('ops.dashboard.submissionsTrend')}
          legend={
            <>
              <ChartLegendItem color={bloxTokens.emerald} label={t('ops.dashboard.weeklySubmissions')} />
            </>
          }
        >
          <LineChart
            labels={(data?.submissions_by_week ?? []).map((w) => w.label)}
            series={[
              {
                label: t('ops.dashboard.applications'),
                data: (data?.submissions_by_week ?? []).map((w) => w.count),
                color: bloxTokens.emerald,
              },
            ]}
          />
        </ChartPanel>

        <ChartPanel title={t('ops.admin.appsByStatus')}>
          {statusBars.length === 0 ? (
            <p className="blox-muted">
              {t('ops.admin.noAppsYet')}
            </p>
          ) : (
            <VerticalBarChart bars={statusBars} />
          )}
        </ChartPanel>
      </div>

      <div className="blox-chart-row blox-dashboard-section">
        <ChartPanel
          title={t('ops.admin.installmentsChart')}
          legend={
            <>
              <ChartLegendItem
                color={bloxTokens.emerald}
                label={`${t('ops.admin.pendingOnSchedule')} — ${settledOrOnTrack}`}
              />
              <ChartLegendItem color={bloxTokens.slate} label={`${t('ops.admin.overdue')} — ${overdue}`} />
            </>
          }
        >
          <div className="blox-chart-donut">
            <Doughnut data={chartData} options={doughnutChartOptions} />
          </div>
        </ChartPanel>

        <ChartPanel title={t('ops.dashboard.topDealers')}>
          {topDealers.length === 0 ? (
            <p className="blox-muted">{t('ops.admin.noAppsYet')}</p>
          ) : (
            topDealers.map((d) => (
              <HorizontalBarChart
                key={d.company_id}
                label={`${d.company_name} — ${d.count}`}
                value={d.count}
                maxValue={maxDealer}
                color={bloxTokens.emerald}
                showValue={false}
              />
            ))
          )}
        </ChartPanel>
      </div>

      {funnel && (
        <div className="blox-chart-row blox-dashboard-section">
          <ChartPanel title={t('ops.admin.conversionFunnel')}>
            <FunnelChart
              stages={[
                { label: applicationStatus('draft'), value: funnel.draft },
                { label: applicationStatus('under_review'), value: funnel.under_review },
                { label: applicationStatus('active'), value: funnel.active },
                { label: applicationStatus('completed'), value: funnel.completed },
                { label: applicationStatus('rejected'), value: funnel.rejected },
              ].map((stage) => ({
                ...stage,
                percentage: funnelTotal > 0 ? (stage.value / funnelTotal) * 100 : 0,
              }))}
            />
          </ChartPanel>
        </div>
      )}

      {(data?.recent_activity?.length ?? 0) > 0 && (
        <OpsContentCard staticHover className="blox-dashboard-section">
          <h2 className="blox-panel__title">{t('ops.dashboard.recentActivity')}</h2>
          <OpsDataTable
            columns={['Action', 'Entity', 'Actor', 'When']}
            rows={(data?.recent_activity ?? []).map((row) => [
              row.action,
              row.entity_type,
              row.actor_email ?? '—',
              new Date(row.created_at).toLocaleString(),
            ])}
          />
        </OpsContentCard>
      )}

      <SecuritySettingsPanel />
    </OpsDashboardPage>
  );
}
