import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, OpsDashboardPage, OpsSecondaryButton } from '@drivemarket/shared';

export function SystemPage() {
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const { data, error } = useQuery({
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
      }>('/api/ops/metrics'),
  });
  const active = data?.applications_by_status?.active ?? 0;
  const underReview = data?.applications_by_status?.under_review ?? 0;
  return (
    <OpsDashboardPage
      title="System"
      subtitle="Live platform metrics"
      error={error ? (error as Error).message : undefined}
      metrics={[
        { label: 'Users', value: String(data?.users_total ?? '—'), delta: `${data?.customers_total ?? 0} customers` },
        { label: 'Active dealers', value: String(data?.companies_active ?? '—') },
        { label: 'Published vehicles', value: String(data?.products_published ?? '—') },
        { label: 'Applications in review', value: String(underReview), delta: `${active} active financings` },
        { label: 'Installments pending', value: String(data?.schedules_pending ?? '—'), delta: `${data?.schedules_overdue ?? 0} overdue` },
      ]}
    >
      <section className="blox-detail-section blox-detail-section--narrow">
        <h2 className="blox-panel__title">Production seeds</h2>
        <p className="blox-muted">
          Idempotent ops — safe to run more than once.
        </p>
        {seedMsg && <p>{seedMsg}</p>}
        <div className="blox-inline-actions blox-inline-actions--wrap blox-mt-3">
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/seed-finance-partners', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Seed finance partners
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/bootstrap-qauto', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Bootstrap QAuto companies
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/seed-qauto-inventory', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Seed QAuto inventory
          </OpsSecondaryButton>
          <OpsSecondaryButton
            type="button"
            onClick={() =>
              apiFetch('/api/ops/upload-qauto-listing-images', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Upload QAuto listing images
          </OpsSecondaryButton>
        </div>
      </section>
    </OpsDashboardPage>
  );
}
