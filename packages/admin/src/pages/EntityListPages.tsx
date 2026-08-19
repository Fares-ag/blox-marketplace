import { useQuery } from '@tanstack/react-query';
import { apiFetch, OpsEmptyState } from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill } from '../components/ui';

/**
 * Offers list backed by the real API. The former Promotions and Packages pages
 * were removed: they rendered fabricated data with no backing endpoints
 * (audit P0-5) — reintroduce them only alongside real backend support.
 */
export function OffersPage() {
  const { data, error } = useQuery({
    queryKey: ['admin-offers'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          name: string;
          annualRentRate: string | number;
          tenureOptions: number[];
          minDownPaymentPct: string | number;
          isDefault: boolean;
        }>
      >('/api/offers'),
  });

  return (
    <div className="blox-page">
      <PageHeader title="Offers" subtitle="Active financing offer templates" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <DataTable
        columns={['Name', 'Annual rate', 'Tenures', 'Min down payment', 'Default']}
        empty={<OpsEmptyState title="No active offers" body="Seed or create offers to enable financing." />}
        rows={(data ?? []).map((o) => [
          o.name,
          <span key="r" className="blox-money">{Number(o.annualRentRate)}%</span>,
          Array.isArray(o.tenureOptions) ? o.tenureOptions.join(' / ') + ' mo' : '—',
          `${Number(o.minDownPaymentPct)}%`,
          o.isDefault ? <StatusPill key="d" label="default" variant="approved" /> : '—',
        ])}
      />
    </div>
  );
}
