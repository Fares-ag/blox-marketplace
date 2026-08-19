import { useQuery } from '@tanstack/react-query';
import { apiFetch, OpsEmptyState } from '@drivemarket/shared';
import { DataTable, PageHeader, StatusPill, type PillVariant } from '../components/ui';

function listingVariant(status: string): PillVariant {
  if (status === 'published') return 'approved';
  if (status === 'sold') return 'rejected';
  return 'pending';
}

export function ProductsPage() {
  const { data, error } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          slug: string;
          make: string;
          model: string;
          model_year: number;
          price: number;
          listing_status: string;
          company_name: string;
          updated_at: string;
        }>;
      }>('/api/ops/products?limit=100'),
  });

  return (
    <div className="blox-page">
      <PageHeader
        title="Products"
        subtitle={`Vehicle catalog across all dealers${data ? ` — ${data.total} total` : ''}`}
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <DataTable
        columns={['Vehicle', 'Dealer', 'Price', 'Status', 'Updated']}
        empty={<OpsEmptyState title="No products" body="Dealer inventory appears here." />}
        rows={(data?.items ?? []).map((p) => [
          `${p.make} ${p.model} ${p.model_year}`,
          p.company_name,
          <span key="p" className="blox-money">QAR {p.price.toLocaleString()}</span>,
          <StatusPill key="s" label={p.listing_status} variant={listingVariant(p.listing_status)} />,
          new Date(p.updated_at).toLocaleDateString(),
        ])}
      />
    </div>
  );
}
