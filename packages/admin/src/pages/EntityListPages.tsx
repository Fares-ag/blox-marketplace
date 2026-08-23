import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OpsDataTable,
  OpsEmptyState,
  OpsFormPage,
  OpsFormSection,
  OpsListPage,
  OpsStatusPill,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
} from '@drivemarket/shared';

type StaffOffer = {
  id: string;
  name: string;
  annual_rent_rate: number;
  profit_rate?: number | null;
  tenure_options: number[];
  min_down_payment_pct: number;
  is_default?: boolean;
  status?: string;
};

export function OffersPage() {
  const [page, setPage] = useState(0);
  const { data, error } = useQuery({
    queryKey: ['admin-offers', page],
    queryFn: () =>
      apiFetch<{ total: number; items: StaffOffer[] }>(`/api/ops/offers?${buildPaginationQuery(page)}`),
  });
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  return (
    <OpsListPage
      title="Offers"
      subtitle="Financing offer templates"
      headerActions={
        <Link className="blox-btn blox-btn--primary" to="/main/offers/new">
          Add offer
        </Link>
      }
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
    >
      <OpsDataTable
        columns={['Name', 'Annual rate', 'Profit', 'Tenures', 'Min down', 'Status']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title="No offers" body="Create an offer to enable financing." />}
        rows={(data?.items ?? []).map((o) => [
          <Link key="n" to={`/main/offers/${o.id}`}>{o.name}</Link>,
          <span key="r" className="blox-money">{Number(o.annual_rent_rate)}%</span>,
          o.profit_rate != null ? `${o.profit_rate}%` : '—',
          Array.isArray(o.tenure_options) ? o.tenure_options.join(' / ') + ' mo' : '—',
          `${Number(o.min_down_payment_pct)}%`,
          o.is_default ? <OpsStatusPill key="d" label="default" variant="approved" /> : o.status ?? '—',
        ])}
      />
    </OpsListPage>
  );
}

export function OfferEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [annualRentRate, setAnnualRentRate] = useState(12.5);
  const [profitRate, setProfitRate] = useState(0);
  const [tenures, setTenures] = useState('12,24,36,48,60');
  const [minDown, setMinDown] = useState(10);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['admin-offer', id],
    queryFn: () => apiFetch<StaffOffer>(`/api/ops/offers/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!existing.data) return;
    const o = existing.data;
    setName(o.name);
    setAnnualRentRate(Number(o.annual_rent_rate));
    setProfitRate(Number(o.profit_rate ?? 0));
    setTenures(Array.isArray(o.tenure_options) ? o.tenure_options.join(',') : '36');
    setMinDown(Number(o.min_down_payment_pct));
    setIsDefault(!!o.is_default);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        annualRentRate,
        profitRate,
        tenureOptions: tenures.split(',').map((n) => Number(n.trim())).filter((n) => n > 0),
        minDownPaymentPct: minDown,
        isDefault,
      };
      return isNew
        ? apiFetch<StaffOffer>('/api/ops/offers', { method: 'POST', body: JSON.stringify(body) })
        : apiFetch<StaffOffer>(`/api/ops/offers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['admin-offers'] });
      navigate(`/main/offers/${row.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <OpsFormPage
      title={isNew ? 'New offer' : 'Edit offer'}
      subtitle="Staff-only profit rate is never shown to customers"
    >
      <OpsFormSection title="Offer terms">
        <form className="blox-form" onSubmit={onSubmit}>
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Annual rent rate %
            <input type="number" step={0.1} value={annualRentRate} onChange={(e) => setAnnualRentRate(Number(e.target.value))} />
          </label>
          <label>
            Profit rate %
            <input type="number" step={0.1} value={profitRate} onChange={(e) => setProfitRate(Number(e.target.value))} />
          </label>
          <label>
            Tenure options (months, comma)
            <input value={tenures} onChange={(e) => setTenures(e.target.value)} />
          </label>
          <label>
            Min down payment %
            <input type="number" value={minDown} onChange={(e) => setMinDown(Number(e.target.value))} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Default offer
          </label>
          {error && <p style={{ color: 'var(--blox-danger)' }}>{error}</p>}
          <button type="submit" className="blox-btn blox-btn--primary" disabled={save.isPending}>
            Save
          </button>
        </form>
      </OpsFormSection>
    </OpsFormPage>
  );
}
