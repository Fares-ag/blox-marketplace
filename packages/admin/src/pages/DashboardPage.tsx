import { useQuery } from '@tanstack/react-query';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { apiFetch, bloxTokens, SecuritySettingsPanel, useOpsLabels } from '@drivemarket/shared';
import { PageHeader, StatCard } from '../components/ui';

ChartJS.register(ArcElement, Tooltip, Legend);

type Metrics = {
  users_total: number;
  customers_total: number;
  companies_active: number;
  products_published: number;
  applications_by_status: Record<string, number>;
  schedules_pending: number;
  schedules_overdue: number;
};

export function DashboardPage() {
  const { t, applicationStatus } = useOpsLabels();
  const { data, error } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiFetch<Metrics>('/api/ops/metrics'),
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

  return (
    <div className="blox-page">
      <PageHeader title={t('ops.admin.dashboardTitle')} subtitle={t('ops.admin.dashboardSubtitle')} />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}

      <div className="blox-stat-grid">
        <StatCard
          label={t('ops.admin.customers')}
          value={String(data?.customers_total ?? '—')}
          delta={t('ops.admin.totalUsers', { count: data?.users_total ?? 0 })}
        />
        <StatCard label={t('ops.admin.activeDealers')} value={String(data?.companies_active ?? '—')} />
        <StatCard label={t('ops.admin.publishedVehicles')} value={String(data?.products_published ?? '—')} />
        <StatCard
          label={t('ops.admin.appsInReview')}
          value={String(inReview)}
          delta={t('ops.admin.activeCompleted', { active, completed })}
        />
      </div>

      <div className="blox-chart-row">
        <section className="blox-panel">
          <h2 className="blox-panel__title">{t('ops.admin.installmentsChart')}</h2>
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                cutout: '68%',
                plugins: { legend: { display: false } },
              }}
            />
          </div>
          <div className="blox-chart-legend">
            <div className="blox-chart-legend__item">
              <span className="blox-chart-legend__dot" style={{ background: bloxTokens.emerald }} />
              {t('ops.admin.pendingOnSchedule')} — {settledOrOnTrack}
            </div>
            <div className="blox-chart-legend__item">
              <span className="blox-chart-legend__dot" style={{ background: bloxTokens.slate }} />
              {t('ops.admin.overdue')} — {overdue}
            </div>
          </div>
        </section>

        <section className="blox-panel">
          <h2 className="blox-panel__title">{t('ops.admin.appsByStatus')}</h2>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div
                  key={status}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}
                >
                  <span style={{ color: 'var(--blox-slate)' }}>{applicationStatus(status)}</span>
                  <span className="blox-money">{count}</span>
                </div>
              ))}
            {Object.keys(byStatus).length === 0 && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--blox-slate)' }}>
                {t('ops.admin.noAppsYet')}
              </p>
            )}
          </div>
        </section>
      </div>
      <SecuritySettingsPanel />
    </div>
  );
}
