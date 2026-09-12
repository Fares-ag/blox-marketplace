import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetch,
  ACTIVE_FINANCING_STATUSES,
  ChartPanel,
  CONTRACT_STAGE_STATUSES,
  IN_REVIEW_METRIC_STATUSES,
  DashboardPipelineSection,
  DashboardGrid,
  FunnelChart,
  LineChart,
  OpsContentCard,
  OpsDashboardPage,
  OpsDataTable,
  OpsGhostButton,
  OpsPrimaryButton,
  OpsSecondaryButton,
  OpsStatusPill,
  sumStatuses,
  VerticalBarChart,
  applicationOpsPillVariant,
  bloxTokens,
  chartColorAt,
  useOpsLabels,
} from '@drivemarket/shared';

type CreditMetrics = {
  in_review: number;
  resubmissions_pending: number;
  approved_today: number;
  rejected_30d: number;
  zoho_failures: number;
  queue_by_status: Record<string, number>;
  priority_queue: Array<{
    id: string;
    customer_email: string;
    status: string;
    updated_at: string;
  }>;
  review_volume_by_week: Array<{ label: string; count: number }>;
};

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const { data, error } = useQuery({
    queryKey: ['credit-metrics'],
    queryFn: () => apiFetch<CreditMetrics>('/api/ops/metrics/credit'),
  });

  const queue = data?.queue_by_status ?? {};
  const dash = (value: number | undefined) => String(value ?? '—');
  const totalInQueue = sumStatuses(queue, IN_REVIEW_METRIC_STATUSES);
  const contractsStage = sumStatuses(queue, CONTRACT_STAGE_STATUSES);
  const activeFinancings = sumStatuses(queue, ACTIVE_FINANCING_STATUSES);
  const funnelStages = [
    { key: 'under_review', label: applicationStatus('under_review') },
    { key: 'resubmission_required', label: applicationStatus('resubmission_required') },
    { key: 'active', label: applicationStatus('active') },
    { key: 'rejected', label: applicationStatus('rejected') },
  ];
  const funnelTotal = funnelStages.reduce((sum, s) => sum + (queue[s.key] ?? 0), 0);

  const statusBars = Object.entries(queue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([status, count], index) => ({
      label: applicationStatus(status),
      value: count,
      color: chartColorAt(index),
    }));

  return (
    <OpsDashboardPage
      title={t('ops.credit.dashboardTitle')}
      subtitle={t('ops.credit.dashboardSubtitle')}
      headerActions={
        <Link to="/queue" className="blox-link-reset">
          <OpsPrimaryButton>{t('ops.credit.nav.queue')}</OpsPrimaryButton>
        </Link>
      }
      error={error ? (error as Error).message : undefined}
      metrics={[
        {
          label: t('ops.dashboard.totalInQueue'),
          value: dash(totalInQueue),
          trend: data?.review_volume_by_week?.map((w: { count: number }) => w.count),
        },
        { label: t('ops.dashboard.inReview'), value: dash(data?.in_review) },
        { label: t('ops.dashboard.resubmissions'), value: dash(data?.resubmissions_pending) },
        { label: t('ops.dashboard.contractsStage'), value: dash(contractsStage) },
        { label: t('ops.dashboard.partnerProcessing'), value: dash(queue.partner_processing) },
        { label: t('ops.dashboard.activeFinancings'), value: dash(activeFinancings) },
        { label: t('ops.dashboard.approvedToday'), value: dash(data?.approved_today) },
        { label: t('ops.dashboard.rejected30d'), value: dash(data?.rejected_30d) },
        { label: t('ops.credit.nav.zohoFailures'), value: dash(data?.zoho_failures) },
      ]}
    >
      <DashboardPipelineSection
        title={t('ops.dashboard.pipelineSnapshot')}
        subtitle={t('ops.admin.appsByStatus')}
        stats={[
          { label: applicationStatus('draft'), value: dash(queue.draft), status: 'draft' },
          { label: applicationStatus('under_review'), value: dash(queue.under_review), status: 'under_review' },
          {
            label: applicationStatus('resubmission_required'),
            value: dash(queue.resubmission_required),
            status: 'resubmission_required',
          },
          { label: t('ops.dashboard.contractsStage'), value: dash(contractsStage), tone: 'progress' },
          {
            label: applicationStatus('partner_processing'),
            value: dash(queue.partner_processing),
            status: 'partner_processing',
          },
          { label: applicationStatus('active'), value: dash(queue.active), status: 'active' },
          { label: applicationStatus('completed'), value: dash(queue.completed), status: 'completed' },
          { label: applicationStatus('rejected'), value: dash(queue.rejected), status: 'rejected' },
        ]}
        columns={4}
      />
      <DashboardGrid>
        <ChartPanel title={t('ops.dashboard.reviewFunnel')}>
          <FunnelChart
            stages={funnelStages.map((s) => ({
              label: s.label,
              value: queue[s.key] ?? 0,
              percentage: funnelTotal > 0 ? ((queue[s.key] ?? 0) / funnelTotal) * 100 : 0,
            }))}
          />
        </ChartPanel>

        <ChartPanel title={t('ops.dashboard.reviewVolume')}>
          <LineChart
            labels={(data?.review_volume_by_week ?? []).map((w) => w.label)}
            series={[
              {
                label: t('ops.dashboard.applications'),
                data: (data?.review_volume_by_week ?? []).map((w) => w.count),
                color: bloxTokens.emerald,
              },
            ]}
          />
        </ChartPanel>
      </DashboardGrid>

      {statusBars.length > 0 && (
        <div className="blox-dashboard-section">
          <ChartPanel title={t('ops.admin.appsByStatus')}>
            <VerticalBarChart bars={statusBars} />
          </ChartPanel>
        </div>
      )}

      <OpsContentCard staticHover className="blox-dashboard-section">
        <h2 className="blox-panel__title">{t('ops.dashboard.priorityQueue')}</h2>
        {(data?.priority_queue?.length ?? 0) === 0 ? (
          <p className="blox-muted">{t('ops.dashboard.priorityQueueEmpty')}</p>
        ) : (
          <OpsDataTable
            columns={['Customer', 'Status', 'Waiting since', '']}
            rows={(data?.priority_queue ?? []).map((row) => [
              row.customer_email,
              <OpsStatusPill
                key={`${row.id}-pill`}
                label={applicationStatus(row.status)}
                variant={applicationOpsPillVariant(row.status)}
              />,
              new Date(row.updated_at).toLocaleDateString(),
              <Link key={`${row.id}-link`} to={`/applications/${row.id}`} className="blox-link-reset">
                <OpsGhostButton>{t('ops.dashboard.open')}</OpsGhostButton>
              </Link>,
            ])}
          />
        )}
      </OpsContentCard>

      <OpsContentCard staticHover className="blox-dashboard-section">
        <h2 className="blox-panel__title">{t('ops.dashboard.quickLinks')}</h2>
        <div className="blox-stack">
          <Link to="/queue" className="blox-link-reset">
            <OpsPrimaryButton>{t('ops.credit.nav.queue')}</OpsPrimaryButton>
          </Link>
          <Link to="/applications" className="blox-link-reset">
            <OpsSecondaryButton>{t('ops.credit.nav.applications')}</OpsSecondaryButton>
          </Link>
          {(data?.zoho_failures ?? 0) > 0 ? (
            <Link to="/zoho-failures" className="blox-link-reset">
              <OpsGhostButton>{t('ops.credit.nav.zohoFailures')}</OpsGhostButton>
            </Link>
          ) : null}
        </div>
      </OpsContentCard>
    </OpsDashboardPage>
  );
}
