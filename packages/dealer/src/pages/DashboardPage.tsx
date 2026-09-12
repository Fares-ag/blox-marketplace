import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DashboardGrid,
  DashboardPipelineSection,
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
  StatusDonutChart,
  originationFunnelChartStages,
  ACTIVE_FINANCING_STATUSES,
  apiFetch,
  bloxTokens,
  listingChartColor,
  CONTRACT_STAGE_STATUSES,
  sumStatuses,
  totalStatuses,
  useOpsLabels,
  type OriginationFunnelDto,
  type OriginationFunnelRow,
} from '@drivemarket/shared';

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

type DealerCompanyProfile = {
  id: string;
  name: string;
  code: string | null;
  logo_url: string | null;
};

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
  const company = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<DealerCompanyProfile | null>('/api/companies/mine'),
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
  const appSegments = Object.entries(appStatus).map(([status, value]) => ({
    status,
    label: applicationStatus(status),
    value,
  }));
  const totalListings = inv.draft + inv.published + inv.reserved + inv.sold;
  const totalApplications = totalStatuses(appStatus);
  const activeFinancings = sumStatuses(appStatus, ACTIVE_FINANCING_STATUSES);
  const contractsStage = sumStatuses(appStatus, CONTRACT_STAGE_STATUSES);
  const dash = (value: number | undefined) => String(value ?? '—');

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
        {
          label: t('ops.dashboard.totalListings'),
          value: dash(totalListings),
          delta: `${inv.published} ${t('ops.listingStatus.published').toLowerCase()}`,
          tone: 'brand',
        },
        { label: t('ops.dashboard.openApplications'), value: dash(data?.open_applications), tone: 'info' },
        { label: t('ops.dashboard.totalApplications'), value: dash(totalApplications), tone: 'neutral' },
        { label: t('ops.dashboard.activeFinancings'), value: dash(activeFinancings), tone: 'success' },
        { label: t('ops.dashboard.activeQuotes'), value: dash(data?.quotes_active), tone: 'info' },
        { label: t('ops.dashboard.expiredQuotes'), value: dash(data?.quotes_expired), tone: 'warning' },
        {
          label: t('ops.dashboard.submissionsMonth'),
          value: dash(data?.submissions_this_month),
          delta: `${inv.draft} ${t('ops.listingStatus.draft').toLowerCase()}`,
          deltaTone: 'neutral',
          trend: data?.submissions_by_week?.map((w: { count: number }) => w.count),
          tone: 'progress',
        },
        { label: t('ops.dashboard.resubmissions'), value: dash(appStatus.resubmission_required), tone: 'warning' },
      ]}
    >
      <DashboardPipelineSection
        title={t('ops.dashboard.pipelineSnapshot')}
        subtitle={t('ops.dashboard.applicationsByStatus')}
        stats={[
          { label: applicationStatus('under_review'), value: dash(appStatus.under_review), status: 'under_review' },
          {
            label: applicationStatus('resubmission_required'),
            value: dash(appStatus.resubmission_required),
            status: 'resubmission_required',
          },
          { label: t('ops.dashboard.contractsStage'), value: dash(contractsStage), tone: 'progress' },
          {
            label: applicationStatus('partner_processing'),
            value: dash(appStatus.partner_processing),
            status: 'partner_processing',
          },
          { label: applicationStatus('active'), value: dash(appStatus.active), status: 'active' },
          { label: applicationStatus('completed'), value: dash(appStatus.completed), status: 'completed' },
          { label: applicationStatus('rejected'), value: dash(appStatus.rejected), status: 'rejected' },
          {
            label: applicationStatus('submission_cancelled'),
            value: dash(appStatus.submission_cancelled),
            status: 'submission_cancelled',
          },
        ]}
      />
      {company.data?.logo_url ? (
        <div className="blox-dashboard-brand">
          <img
            src={company.data.logo_url}
            alt={company.data.name}
            className="blox-dashboard-brand__logo"
          />
        </div>
      ) : null}
      <DashboardGrid className="blox-dashboard-grid--duo">
        <ChartPanel title={t('ops.dealer.inventoryByStatus')}>
          <VerticalBarChart
            bars={[
              { label: t('ops.listingStatus.draft'), value: inv.draft, color: listingChartColor('draft') },
              { label: t('ops.listingStatus.published'), value: inv.published, color: listingChartColor('published') },
              { label: t('ops.listingStatus.reserved'), value: inv.reserved, color: listingChartColor('reserved') },
              { label: t('ops.listingStatus.sold'), value: inv.sold, color: listingChartColor('sold') },
            ]}
          />
        </ChartPanel>

        <ChartPanel title={t('ops.dashboard.applicationsByStatus')}>
          <StatusDonutChart
            segments={appSegments}
            emptyLabel={t('ops.admin.noAppsYet')}
            totalLabel={t('ops.dashboard.totalApplications')}
          />
        </ChartPanel>
      </DashboardGrid>

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
          <DashboardGrid className="blox-dashboard-grid--split">
            <FunnelChart
              stages={
                totals
                  ? originationFunnelChartStages(totals, {
                      submitted: t('originationAnalytics.stages.submitted'),
                      approved: t('originationAnalytics.stages.approved'),
                      activated: t('originationAnalytics.stages.activated'),
                    })
                  : []
              }
            />
            <div className="blox-stat-grid">
              <OpsStatCard
                label={t('originationAnalytics.stages.submitted')}
                value={String(totals?.submitted ?? '—')}
                delta={totals ? t('dealerOps.dashboard.draftsOpen', { count: totals.drafts }) : undefined}
                tone="brand"
              />
              <OpsStatCard
                label={t('originationAnalytics.conversion')}
                value={pct(totals?.approval_rate)}
                delta={
                  totals
                    ? t('dealerOps.dashboard.approvedOfSubmitted', {
                        approved: totals.approved,
                        submitted: totals.submitted,
                      })
                    : undefined
                }
                tone="progress"
              />
              <OpsStatCard label={t('originationAnalytics.tat')} value={hours(totals?.median_approval_hours)} tone="info" />
              <OpsStatCard label={t('originationAnalytics.tatUnder24h')} value={pct(totals?.under_24h_rate)} tone="success" />
            </div>
          </DashboardGrid>
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

      <DashboardGrid>
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
      </DashboardGrid>
    </OpsDashboardPage>
  );
}

/** @deprecated use DashboardPage */
export const Dashboard = DashboardPage;
