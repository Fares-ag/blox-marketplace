import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  FilterPanel,
  OpsCoreTable,
  OpsFormPage,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsSecondaryButton,
  OpsToolbar,
  SearchBar,
  StatusBadge,
  apiFetch,
  buildPaginationQuery,
  formatQar,
  useOpsLabels,
  type FilterConfig,
  type OpsTableColumn,
  type PaginatedResponse,
} from '@drivemarket/shared';

type ProductRow = {
  id: string;
  slug: string;
  make: string;
  model: string;
  model_year: number;
  price: number;
  listing_status: string;
  company_name: string;
  updated_at: string;
};

type ProductDetail = ProductRow & {
  finance_eligible?: boolean;
  default_offer_id?: string | null;
  description?: string | null;
};

export function ProductsPage() {
  const { t, listingStatus: listingStatusLabel } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ['admin-products', page, rowsPerPage],
    queryFn: () =>
      apiFetch<{ total: number; items: ProductRow[] }>(
        `/api/ops/products?${buildPaginationQuery(page, rowsPerPage)}`,
      ),
  });
  const bulk = useMutation({
    mutationFn: (nextStatus: string) =>
      apiFetch('/api/ops/products/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ ids: selected, listingStatus: nextStatus }),
      }),
    onSuccess: () => {
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  const statusFilter = typeof filters.listingStatus === 'string' ? filters.listingStatus : '';
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: 'listingStatus',
        label: 'Listing status',
        type: 'select',
        options: ['draft', 'published', 'reserved', 'sold', 'archived'].map((value) => ({
          value,
          label: listingStatusLabel(value),
        })),
      },
    ],
    [listingStatusLabel],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((p) => {
      if (statusFilter && p.listing_status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${p.make} ${p.model} ${p.model_year} ${p.company_name} ${p.slug}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.items, search, statusFilter]);

  const columns: OpsTableColumn<ProductRow>[] = useMemo(
    () => [
      {
        id: 'select',
        label: '',
        minWidth: 48,
        format: (_, row) => (
          <input
            type="checkbox"
            checked={selected.includes(row.id)}
            onChange={() =>
              setSelected((prev) => (prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]))
            }
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.make} ${row.model}`}
          />
        ),
      },
      {
        id: 'vehicle',
        label: 'Vehicle',
        minWidth: 180,
        format: (_, row) => (
          <Link to={`/main/vehicles/${row.id}`}>
            {row.make} {row.model} {row.model_year}
          </Link>
        ),
      },
      { id: 'company_name', label: 'Dealer', minWidth: 140 },
      {
        id: 'price',
        label: 'Price',
        align: 'right',
        minWidth: 120,
        format: (value) => <span className="blox-money">{formatQar(Number(value))}</span>,
      },
      {
        id: 'listing_status',
        label: 'Status',
        minWidth: 120,
        format: (value) => (
          <StatusBadge status={String(value)} type="listing" label={listingStatusLabel(String(value))} />
        ),
      },
      {
        id: 'updated_at',
        label: 'Updated',
        minWidth: 120,
        format: (value) => new Date(String(value)).toLocaleDateString(),
      },
    ],
    [listingStatusLabel, selected],
  );

  return (
    <OpsListPage
      title="Vehicles"
      subtitle={`Vehicle catalog across all dealers${data ? ` — ${data.total} total` : ''}`}
      headerActions={
        <>
          <Link to="/main/vehicles/add" style={{ textDecoration: 'none' }}>
            <OpsPrimaryButton>Add vehicle</OpsPrimaryButton>
          </Link>
          {selected.length > 0 && (
            <>
              <OpsSecondaryButton type="button" onClick={() => bulk.mutate('published')}>
                Activate ({selected.length})
              </OpsSecondaryButton>
              <OpsGhostButton type="button" onClick={() => bulk.mutate('draft')}>
                Deactivate
              </OpsGhostButton>
            </>
          )}
        </>
      }
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setSelected([]);
              }}
              placeholder={t('ops.common.search')}
            />
          }
          filters={
            <FilterPanel
              filters={filterConfigs}
              values={filters}
              onChange={(next) => {
                setFilters(next);
                setSelected([]);
              }}
              onClear={() => setFilters({})}
            />
          }
        />
      }
    >
      <OpsCoreTable
        columns={columns}
        rows={filteredItems}
        loading={isLoading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        onRowsPerPageChange={(next) => {
          setRowsPerPage(next);
          setPage(0);
        }}
        emptyMessage="Dealer inventory appears here."
      />
    </OpsListPage>
  );
}

export function ProductEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'add';
  const qc = useQueryClient();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [modelYear, setModelYear] = useState(new Date().getFullYear());
  const [companyId, setCompanyId] = useState('');
  const [price, setPrice] = useState(0);
  const [financeEligible, setFinanceEligible] = useState(true);
  const [defaultOfferId, setDefaultOfferId] = useState('');
  const [listingStatusValue, setListingStatusValue] = useState('draft');
  const [error, setError] = useState<string | null>(null);

  const companies = useQuery({
    queryKey: ['admin-companies-mini'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string; name: string }>>('/api/companies/all?limit=100&offset=0'),
    enabled: isNew,
  });

  const { data } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => apiFetch<ProductDetail>(`/api/ops/products/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!data) return;
    setPrice(Number(data.price));
    setFinanceEligible(data.finance_eligible !== false);
    setDefaultOfferId(data.default_offer_id ?? '');
    setListingStatusValue(data.listing_status);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? apiFetch('/api/dealer/inventory', {
            method: 'POST',
            body: JSON.stringify({ make, model, modelYear, price, companyId }),
          })
        : apiFetch(`/api/ops/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              price,
              financeEligible,
              defaultOfferId: defaultOfferId || undefined,
              listingStatus: listingStatusValue,
            }),
          }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-product', id] });
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <OpsFormPage title={data ? `${data.make} ${data.model}` : 'Vehicle'} subtitle={data?.company_name ?? undefined}>
      <OpsFormSection title="Listing">
      <form className="blox-form" onSubmit={onSubmit}>
        {isNew && (
          <>
            <label>Make<input value={make} onChange={(e) => setMake(e.target.value)} required /></label>
            <label>Model<input value={model} onChange={(e) => setModel(e.target.value)} required /></label>
            <label>Year<input type="number" value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} /></label>
            <label>
              Company
              <select required value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Select dealer</option>
                {(companies.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Price (QAR)
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <label>
          Default offer ID
          <input value={defaultOfferId} onChange={(e) => setDefaultOfferId(e.target.value)} />
        </label>
        <label>
          Listing status
          <select value={listingStatusValue} onChange={(e) => setListingStatusValue(e.target.value)}>
            {['draft', 'published', 'reserved', 'sold', 'archived'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={financeEligible} onChange={(e) => setFinanceEligible(e.target.checked)} />
          Finance eligible
        </label>
        {error && <p style={{ color: 'var(--blox-danger)' }}>{error}</p>}
        <OpsPrimaryButton type="submit" disabled={save.isPending}>
          Save
        </OpsPrimaryButton>
      </form>
      </OpsFormSection>
    </OpsFormPage>
  );
}
