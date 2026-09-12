import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Doughnut } from 'react-chartjs-2';
import {
  apiFetch,
  chartColorAt,
  chartPalette,
  ChartPanel,
  ACTIVE_FINANCING_STATUSES,
  CONTRACT_STAGE_STATUSES,
  DashboardGrid,
  DashboardPipelineSection,
  doughnutChartOptions,
  HorizontalBarChart,
  VerticalBarChart,
  LineChart,
  OpsDashboardPage,
  OpsSelect,
  bloxTokens,
  sumStatuses,
  totalStatuses,
  useOpsLabels,
} from '@drivemarket/shared';
import { OriginationFunnelSection } from '../components/OriginationFunnelSection';

export function SuperAdminTypeChart({ data }: { data: Record<string, number> }) {
  const labels = Object.keys(data);
  if (!labels.length) return null;
  return (
    <div className="blox-chart-donut">
      <Doughnut
        data={{
          labels,
          datasets: [{ data: Object.values(data), backgroundColor: [...chartPalette] }],
        }}
        options={doughnutChartOptions}
      />
    </div>
  );
}

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const metrics = useQuery({
    queryKey: ['sa-metrics'],
    queryFn: () =>
      apiFetch<{
        users_total: number;
        customers_total: number;
        companies_active: number;
        products_published: number;
        applications_by_status: Record<string, number>;
        schedules_pending: number;
        schedules_overdue: number;
        platform_growth: Array<{ label: string; users: number; applications: number }>;
      }>('/api/ops/metrics'),
  });
  const stats = useQuery({
    queryKey: ['sa-activity-stats', range],
    queryFn: () =>
      apiFetch<{
        total_actions: number;
        actions_by_type: Record<string, number>;
        actions_by_resource: Record<string, number>;
        actions_by_user: Array<{ user_email: string; count: number }>;
      }>(`/api/ops/activity-stats?range=${range}`),
  });
  const data = metrics.data;
  const byStatus = data?.applications_by_status ?? {};
  const dash = (value: number | undefined) => String(value ?? '—');
  const active = byStatus.active ?? 0;
  const underReview = byStatus.under_review ?? 0;
  const totalApplications = totalStatuses(byStatus);
  const activeFinancings = sumStatuses(byStatus, ACTIVE_FINANCING_STATUSES);
  const contractsStage = sumStatuses(byStatus, CONTRACT_STAGE_STATUSES);
  const completed = byStatus.completed ?? 0;
  const conversionRate = totalApplications > 0 ? completed / totalApplications : 0;
  const statusBars = Object.entries(byStatus).map(([status, count], index) => ({
    label: applicationStatus(status),
    value: count,
    color: chartColorAt(index),
  }));

  return (
    <OpsDashboardPage
      title={t('ops.superAdmin.analyticsTitle')}
      subtitle={t('ops.superAdmin.analyticsSubtitle')}
      heroIndex={4}
      metrics={[
        { label: 'Users', value: dash(data?.users_total), delta: `${data?.customers_total ?? 0} customers` },
        { label: 'Active dealers', value: dash(data?.companies_active) },
        { label: 'Published vehicles', value: dash(data?.products_published) },
        { label: t('ops.dashboard.totalApplications'), value: dash(totalApplications) },
        { label: 'Applications in review', value: dash(underReview), delta: `${activeFinancings} active financings` },
        { label: t('ops.dashboard.activeFinancings'), value: dash(activeFinancings) },
        { label: t('ops.dashboard.conversionRate'), value: `${Math.round(conversionRate * 100)}%`, delta: `${completed} completed` },
        { label: t('ops.dashboard.pendingInstallments'), value: dash(data?.schedules_pending) },
        { label: t('ops.admin.overdue'), value: dash(data?.schedules_overdue) },
        { label: t('ops.superAdmin.totalActions'), value: dash(stats.data?.total_actions) },
      ]}
      toolbar={
        <div className="blox-filter-bar blox-dashboard-section">
          <OpsSelect
            label={t('ops.superAdmin.range30d')}
            value={range}
            onChange={(e) => setRange(e.target.value as typeof range)}
            className="blox-field--w180"
          >
            <option value="7d">{t('ops.superAdmin.range7d')}</option>
            <option value="30d">{t('ops.superAdmin.range30d')}</option>
            <option value="90d">{t('ops.superAdmin.range90d')}</option>
            <option value="all">{t('ops.superAdmin.rangeAll')}</option>
          </OpsSelect>
        </div>
      }
    >
      <DashboardPipelineSection
        title={t('ops.dashboard.pipelineSnapshot')}
        subtitle={t('ops.admin.appsByStatus')}
        stats={[
          { label: applicationStatus('draft'), value: dash(byStatus.draft), status: 'draft' },
          { label: applicationStatus('under_review'), value: dash(byStatus.under_review), status: 'under_review' },
          {
            label: applicationStatus('resubmission_required'),
            value: dash(byStatus.resubmission_required),
            status: 'resubmission_required',
          },
          { label: t('ops.dashboard.contractsStage'), value: dash(contractsStage), tone: 'progress' },
          {
            label: applicationStatus('partner_processing'),
            value: dash(byStatus.partner_processing),
            status: 'partner_processing',
          },
          { label: applicationStatus('active'), value: dash(byStatus.active), status: 'active' },
          { label: applicationStatus('completed'), value: dash(byStatus.completed), status: 'completed' },
          { label: applicationStatus('rejected'), value: dash(byStatus.rejected), status: 'rejected' },
        ]}
      />
      <DashboardGrid>
        <ChartPanel title={t('ops.dashboard.submissionsTrend')}>
          <LineChart
            labels={(data?.platform_growth ?? []).map((w) => w.label)}
            series={[
              { label: 'Users', data: (data?.platform_growth ?? []).map((w) => w.users), color: bloxTokens.deepGreen },
              { label: t('ops.dashboard.applications'), data: (data?.platform_growth ?? []).map((w) => w.applications) },
            ]}
          />
        </ChartPanel>
        <ChartPanel title={t('ops.admin.appsByStatus')}>
          {statusBars.length === 0 ? (
            <p className="blox-muted">{t('ops.admin.noAppsYet')}</p>
          ) : (
            <VerticalBarChart bars={statusBars} />
          )}
        </ChartPanel>
      </DashboardGrid>
      <div className="blox-dashboard-section">
        <OriginationFunnelSection />
      </div>
      <div className="blox-dashboard-section">
        <ChartPanel title={t('ops.superAdmin.byType')}>
          <SuperAdminTypeChart data={stats.data?.actions_by_type ?? {}} />
          {Object.entries(stats.data?.actions_by_type ?? {}).map(([action, count], index) => (
            <HorizontalBarChart
              key={action}
              label={`${action} — ${count}`}
              value={count}
              maxValue={Math.max(...Object.values(stats.data?.actions_by_type ?? {}), 1)}
              color={chartColorAt(index)}
              showValue={false}
            />
          ))}
        </ChartPanel>
      </div>
      <div className="blox-dashboard-section">
        <ChartPanel title={t('ops.superAdmin.byUser')}>
          {(stats.data?.actions_by_user ?? []).map((row, index) => (
            <HorizontalBarChart
              key={row.user_email}
              label={`${row.user_email} — ${row.count}`}
              value={row.count}
              maxValue={Math.max(...(stats.data?.actions_by_user ?? []).map((r) => r.count), 1)}
              color={chartColorAt(index)}
              showValue={false}
            />
          ))}
        </ChartPanel>
      </div>
      <ChartPanel title={t('ops.superAdmin.byResource')}>
        {Object.entries(stats.data?.actions_by_resource ?? {}).map(([entity, count], index) => (
          <HorizontalBarChart
            key={entity}
            label={`${entity} — ${count}`}
            value={count}
            maxValue={Math.max(...Object.values(stats.data?.actions_by_resource ?? {}), 1)}
            color={chartColorAt(index)}
            showValue={false}
          />
        ))}
      </ChartPanel>
    </OpsDashboardPage>
  );
}
