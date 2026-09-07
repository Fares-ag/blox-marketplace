import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  DashboardSection,
  FunnelChart,
  OpsDashboardPage,
  OpsDataTable,
  OpsSegmentedControl,
  OpsStatCard,
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
  type OriginationFunnelDto,
  type OriginationFunnelRow,
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

type FunnelGroup = 'branch' | 'agent';

function pct(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const [groupBy, setGroupBy] = useState<FunnelGroup>('branch');
  const { data } = useQuery({
    queryKey: ['dealer-metrics'],
    queryFn: () => apiFetch<DealerMetrics>('/api/ops/metrics/dealer'),
  });

  // Dealer scope is enforced server-side: the funnel only ever covers this dealership.
  const funnel = useQuery({
    queryKey: ['dealer-origination-funnel', groupBy],
    queryFn: () =>
      apiFetch<OriginationFunnelDto>(`/api/ops/analytics/origination-funnel?group_by=${groupBy}`),
    retry: false,
  });
  const funnelRows: OriginationFunnelRow[] = funnel.data?.rows ?? [];
  const totals = funnel.data?.totals;
  const rowLabel = (row: OriginationFunnelRow) =>
    row.key.startsWith('unassigned:') || !row.label ? t('dealerOps.dashboard.unassigned') : row.label;
  const hours = (value: number | null | undefined) =>
    value == null ? '—' : t('originationAnalytics.tatHours', { hours: Math.round(value) });

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
          <Link to="/quotes" className="blox-link-reset">
            <OpsSecondaryButton>{t('ops.dealer.nav.quotes')}</OpsSecondaryButton>
          </Link>
          <Link to="/inventory/new" className="blox-link-reset">
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
          deltaTone: 'neutral',
          trend: data?.submissions_by_week?.map((w: { count: number }) => w.count),
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
            <p className="blox-muted">{t('ops.admin.noAppsYet')}</p>
          ) : (
            <div className="blox-chart-donut">
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

      <div className="blox-dashboard-section">
        <DashboardSection
          title={t('dealerOps.dashboard.performance')}
          subtitle={t('originationAnalytics.subtitle')}
          actions={
            <OpsSegmentedControl<FunnelGroup>
              tone="light"
              value={groupBy}
              onChange={setGroupBy}
              aria-label={t('originationAnalytics.groupBy')}
              options={[
                { value: 'branch', label: t('originationAnalytics.groupBranch') },
                { value: 'agent', label: t('originationAnalytics.groupAgent') },
              ]}
            />
          }
          loading={funnel.isLoading}
          error={funnel.error ? (funnel.error as Error).message : undefined}
          empty={funnelRows.length === 0}
          emptyTitle={t('originationAnalytics.empty')}
          emptyMessage={t('dealerOps.dashboard.emptyBody')}
        >
          <div className="blox-chart-row">
            <FunnelChart
              stages={[
                { label: t('originationAnalytics.stages.draft'), value: totals?.drafts ?? 0 },
                { label: t('originationAnalytics.stages.submitted'), value: totals?.submitted ?? 0 },
                { label: t('originationAnalytics.stages.approved'), value: totals?.approved ?? 0 },
                { label: t('originationAnalytics.stages.activated'), value: totals?.activated ?? 0 },
              ]}
            />
            <div className="blox-stack">
              <OpsStatCard label={t('originationAnalytics.conversion')} value={pct(totals?.approval_rate)} />
              <OpsStatCard label={t('originationAnalytics.tat')} value={hours(totals?.median_approval_hours)} />
              <OpsStatCard
                label={t('originationAnalytics.tatUnder24h')}
                value={pct(totals?.under_24h_rate)}
                delta={totals ? `${totals.rejected} ${t('originationAnalytics.stages.rejected').toLowerCase()}` : undefined}
              />
            </div>
          </div>
          <OpsDataTable
            columns={[
              groupBy === 'branch' ? t('originationAnalytics.groupBranch') : t('originationAnalytics.groupAgent'),
              t('originationAnalytics.stages.draft'),
              t('originationAnalytics.stages.submitted'),
              t('originationAnalytics.stages.approved'),
              t('originationAnalytics.stages.activated'),
              t('originationAnalytics.stages.rejected'),
              t('dealerOps.dashboard.approvalRate'),
              t('dealerOps.dashboard.medianHours'),
              t('dealerOps.dashboard.under24h'),
            ]}
            numericColumns={[1, 2, 3, 4, 5, 6, 7, 8]}
            rows={funnelRows.map((row) => [
              <span key="label" className="blox-cell-stack">
                <span>{rowLabel(row)}</span>
                {groupBy === 'agent' && row.branch_name ? <small className="blox-muted">{row.branch_name}</small> : null}
              </span>,
              row.drafts,
              row.submitted,
              row.approved,
              row.activated,
              row.rejected,
              pct(row.approval_rate),
              hours(row.median_approval_hours),
              pct(row.under_24h_rate),
            ])}
            empty={t('originationAnalytics.empty')}
          />
        </DashboardSection>
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
            <Link to="/applications/new" className="blox-link-reset">
              <OpsPrimaryButton>{t('ops.dealer.nav.newApplication')}</OpsPrimaryButton>
            </Link>
            <Link to="/inventory" className="blox-link-reset">
              <OpsSecondaryButton>{t('ops.dealer.nav.inventory')}</OpsSecondaryButton>
            </Link>
            <Link to="/applications" className="blox-link-reset">
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
