import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  FilterPanel,
  OpsField,
  OpsFormPage,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsSecondaryButton,
  OpsSelect,
  OpsToolbar,
  SearchBar,
  StatusBadge,
  VehicleCardGrid,
  apiFetch,
  buildPaginationQuery,
  useOpsLabels,
  type FilterConfig,
  type PaginatedResponse,
  type VehicleCardOption,
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
  primary_image?: string | null;
};

type ProductDetail = ProductRow & {
  finance_eligible?: boolean;
  default_offer_id?: string | null;
  description?: string | null;
};

export function ProductsPage() {
  const { t, listingStatus: listingStatusLabel } = useOpsLabels();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      apiFetch<{ total: number; items: ProductRow[] }>(
        `/api/ops/products?${buildPaginationQuery(0, 200)}`,
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

  const vehicleCards: VehicleCardOption[] = useMemo(
    () =>
      filteredItems.map((p) => ({
        id: p.id,
        make: p.make,
        model: p.model,
        model_year: p.model_year,
        price: p.price,
        listing_status: p.listing_status,
        company_name: p.company_name,
        primary_image: p.primary_image ?? null,
      })),
    [filteredItems],
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
      <VehicleCardGrid
        items={vehicleCards}
        loading={isLoading}
        searchable={false}
        selectedIds={selected}
        onToggle={(id) =>
          setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        multiple
        hrefFor={(item) => `/main/vehicles/${item.id}`}
        statusFor={(item) =>
          item.listing_status ? (
            <StatusBadge
              status={item.listing_status}
              type="listing"
              label={listingStatusLabel(item.listing_status)}
            />
          ) : null
        }
        emptyTitle="Dealer inventory appears here."
      />
    </OpsListPage>
  );
}

export function ProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'add';
  const qc = useQueryClient();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [modelYear, setModelYear] = useState(new Date().getFullYear());
  const [companyId, setCompanyId] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [financeEligible, setFinanceEligible] = useState(true);
  const [defaultOfferId, setDefaultOfferId] = useState('');
  const [listingStatusValue, setListingStatusValue] = useState('draft');
  const [error, setError] = useState<string | null>(null);

  const companies = useQuery({
    queryKey: ['admin-companies-mini'],
    queryFn: () =>
      apiFetch<PaginatedResponse<{ id: string; name: string; kind?: string | null }>>(
        '/api/companies/all?limit=100&offset=0',
      ),
    enabled: isNew,
  });

  const dealershipOptions = useMemo(
    () => (companies.data?.items ?? []).filter((c) => c.kind !== 'holding'),
    [companies.data?.items],
  );

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
    mutationFn: () => {
      const priceValue = typeof price === 'number' ? price : Number(price);
      if (isNew) {
        if (!companyId) throw new Error('Select a dealer company.');
        if (!make.trim() || !model.trim()) throw new Error('Make and model are required.');
        if (!Number.isFinite(priceValue) || priceValue < 1) {
          throw new Error('Enter a price of at least QAR 1.');
        }
        return apiFetch<{ id: string }>('/api/dealer/inventory', {
          method: 'POST',
          body: JSON.stringify({
            make: make.trim(),
            model: model.trim(),
            modelYear,
            price: priceValue,
            companyId,
            financeEligible,
            defaultOfferId: defaultOfferId.trim() || undefined,
          }),
        });
      }
      if (!Number.isFinite(priceValue) || priceValue < 1) {
        throw new Error('Enter a price of at least QAR 1.');
      }
      return apiFetch(`/api/ops/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          price: priceValue,
          financeEligible,
          defaultOfferId: defaultOfferId || undefined,
          listingStatus: listingStatusValue,
        }),
      });
    },
    onSuccess: (created) => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-product', id] });
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      if (isNew && created && typeof created === 'object' && 'id' in created) {
        toast.success('Vehicle created');
        navigate(`/main/vehicles/${created.id}`);
        return;
      }
      toast.success('Vehicle saved');
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <OpsFormPage title={data ? `${data.make} ${data.model}` : 'Add vehicle'} subtitle={data?.company_name ?? undefined}>
      <OpsFormSection title="Listing">
        <form className="blox-form" onSubmit={onSubmit}>
          {error && (
            <p className="blox-form-error blox-form-grid__full" role="alert">
              {error}
            </p>
          )}
          {isNew && (
            <>
              <OpsField label="Make" value={make} onChange={(e) => setMake(e.target.value)} required />
              <OpsField label="Model" value={model} onChange={(e) => setModel(e.target.value)} required />
              <OpsField
                label="Year"
                type="number"
                value={modelYear}
                onChange={(e) => setModelYear(Number(e.target.value))}
                required
              />
              <OpsSelect
                label="Dealer company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
              >
                <option value="">Select dealer</option>
                {dealershipOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </OpsSelect>
            </>
          )}
          <OpsField
            label="Price (QAR)"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
          <OpsField
            label="Default offer ID"
            value={defaultOfferId}
            onChange={(e) => setDefaultOfferId(e.target.value)}
            hint="Optional — link an active offer for financing quotes"
          />
          {!isNew && (
            <OpsSelect
              label="Listing status"
              value={listingStatusValue}
              onChange={(e) => setListingStatusValue(e.target.value)}
            >
              {['draft', 'published', 'reserved', 'sold', 'archived'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </OpsSelect>
          )}
          <label className="blox-checkbox-row blox-form-grid__full">
            <input
              type="checkbox"
              checked={financeEligible}
              onChange={(e) => setFinanceEligible(e.target.checked)}
            />
            <span>Finance eligible</span>
          </label>
          <OpsPrimaryButton type="submit" className="blox-form-grid__full blox-form-actions__primary" disabled={save.isPending}>
            {isNew ? 'Create vehicle' : 'Save'}
          </OpsPrimaryButton>
        </form>
      </OpsFormSection>
    </OpsFormPage>
  );
}
