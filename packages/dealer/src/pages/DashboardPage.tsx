import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  OpsDashboardPage,
  VerticalBarChart,
  LineChart,
  ChartPanel,
  ChartLegendItem,
  OpsContentCard,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsSecondaryButton,
  doughnutChartOptions,
  apiFetch,
  bloxTokens,
  chartColorAt,
  useOpsLabels,
} from '@drivemarket/shared';

ChartJS.register(ArcElement, Tooltip, Legend);

type DealerMetrics = {
  inventory: { draft: number; published: number; reserved: number; sold: number };
  applications_by_status: Record<string, number>;
  quotes_active: number;
  quotes_expired: number;
  submissions_this_month: number;
  submissions_by_week: Array<{ label: string; count: number }>;
  open_applications: number;
};

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const { data } = useQuery({
    queryKey: ['dealer-metrics'],
    queryFn: () => apiFetch<DealerMetrics>('/api/ops/metrics/dealer'),
  });

  const inv = data?.inventory ?? { draft: 0, published: 0, reserved: 0, sold: 0 };
  const appStatus = data?.applications_by_status ?? {};
  const appLabels = Object.keys(appStatus);
  const appValues = Object.values(appStatus);

  return (
    <OpsDashboardPage
      title={t('ops.dealer.dashboardTitle')}
      subtitle={t('ops.dealer.dashboardSubtitle')}
      headerActions={
        <div className="blox-inline-actions">
          <Link to="/quotes" style={{ textDecoration: 'none' }}>
            <OpsSecondaryButton>{t('ops.dealer.nav.quotes')}</OpsSecondaryButton>
          </Link>
          <Link to="/inventory/new" style={{ textDecoration: 'none' }}>
            <OpsPrimaryButton>{t('ops.dealer.createListing')}</OpsPrimaryButton>
          </Link>
        </div>
      }
      metrics={[
        { label: t('ops.listingStatus.published'), value: String(inv.published) },
        { label: t('ops.dashboard.openApplications'), value: String(data?.open_applications ?? '—') },
        { label: t('ops.dashboard.activeQuotes'), value: String(data?.quotes_active ?? '—') },
        {
          label: t('ops.dashboard.submissionsMonth'),
          value: String(data?.submissions_this_month ?? '—'),
          delta: `${inv.draft} draft listings`,
        },
      ]}
    >
      <div className="blox-chart-row blox-dashboard-section">
        <ChartPanel title={t('ops.dealer.inventoryByStatus')}>
          <VerticalBarChart
            bars={[
              { label: t('ops.listingStatus.draft'), value: inv.draft, color: chartColorAt(0) },
              { label: t('ops.listingStatus.published'), value: inv.published, color: chartColorAt(1) },
              { label: t('ops.listingStatus.reserved'), value: inv.reserved, color: chartColorAt(2) },
              { label: t('ops.listingStatus.sold'), value: inv.sold, color: chartColorAt(3) },
            ]}
          />
        </ChartPanel>

        <ChartPanel title={t('ops.dashboard.applicationsByStatus')}>
          {appLabels.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--blox-slate)' }}>{t('ops.admin.noAppsYet')}</p>
          ) : (
            <div style={{ maxWidth: 280, margin: '0 auto' }}>
              <Doughnut
                data={{
                  labels: appLabels.map((s) => applicationStatus(s)),
                  datasets: [
                    {
                      data: appValues,
                      backgroundColor: appLabels.map((_, i) => chartColorAt(i)),
                      borderWidth: 0,
                    },
                  ],
                }}
                options={doughnutChartOptions}
              />
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="blox-chart-row blox-dashboard-section">
        <ChartPanel
          title={t('ops.dashboard.submissionsTrend')}
          legend={<ChartLegendItem color={bloxTokens.emerald} label={t('ops.dashboard.weeklySubmissions')} />}
        >
          <LineChart
            labels={(data?.submissions_by_week ?? []).map((w) => w.label)}
            series={[
              {
                label: t('ops.dashboard.applications'),
                data: (data?.submissions_by_week ?? []).map((w) => w.count),
              },
            ]}
          />
        </ChartPanel>

        <OpsContentCard staticHover>
          <h2 className="blox-panel__title">{t('ops.dashboard.quickLinks')}</h2>
          <div className="blox-stack">
            <Link to="/applications/new" style={{ textDecoration: 'none' }}>
              <OpsPrimaryButton>{t('ops.dealer.nav.newApplication')}</OpsPrimaryButton>
            </Link>
            <Link to="/inventory" style={{ textDecoration: 'none' }}>
              <OpsSecondaryButton>{t('ops.dealer.nav.inventory')}</OpsSecondaryButton>
            </Link>
            <Link to="/applications" style={{ textDecoration: 'none' }}>
              <OpsGhostButton>{t('ops.dealer.nav.applications')}</OpsGhostButton>
            </Link>
          </div>
        </OpsContentCard>
      </div>
    </OpsDashboardPage>
  );
}

/** @deprecated use DashboardPage */
export const Dashboard = DashboardPage;
