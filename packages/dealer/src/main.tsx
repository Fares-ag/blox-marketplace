import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Navigate, Route, Routes, Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  BloxShell,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  formatQar,
  MoneyText,
  listingOpsPillVariant,
  applicationOpsPillVariant,
  OpsEmptyState,
  useOpsLabels,
  mountPortalApp,
  type BloxNavItem,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

type CompanyProfile = {
  name: string;
  code: string | null;
  status: string;
  logoUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  branding: Record<string, unknown> | null;
};

function Dashboard() {
  const { t } = useOpsLabels();
  const { data } = useQuery({
    queryKey: ['dealer-inventory', 'dashboard'],
    queryFn: () =>
      apiFetch<{ total: number; items: Array<{ listingStatus: string }> }>(
        '/api/dealer/inventory?limit=100&offset=0',
      ),
  });
  const items = data?.items ?? [];
  const counts = {
    draft: items.filter((p) => p.listingStatus === 'draft').length,
    published: items.filter((p) => p.listingStatus === 'published').length,
    reserved: items.filter((p) => p.listingStatus === 'reserved').length,
    sold: items.filter((p) => p.listingStatus === 'sold').length,
  };
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.dealer.dashboardTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.dealer.dashboardSubtitle')}</p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--primary" to="/inventory/new">
            {t('ops.dealer.createListing')}
          </Link>
        </div>
      </header>
      <div className="blox-stat-grid">
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">{t('ops.listingStatus.draft')}</p>
          <p className="blox-stat-card__value blox-money">{counts.draft}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">{t('ops.listingStatus.published')}</p>
          <p className="blox-stat-card__value blox-money">{counts.published}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">{t('ops.listingStatus.reserved')}</p>
          <p className="blox-stat-card__value blox-money">{counts.reserved}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">{t('ops.listingStatus.sold')}</p>
          <p className="blox-stat-card__value blox-money">{counts.sold}</p>
        </article>
      </div>
    </div>
  );
}

function InventoryList() {
  const { t, listingStatus, pagination: pagLabel } = useOpsLabels();
  const [page, setPage] = useState(0);
  const { data, error } = useQuery({
    queryKey: ['dealer-inventory', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          make: string;
          model: string;
          modelYear: number;
          price: string | number;
          listingStatus: string;
        }>;
      }>(`/api/dealer/inventory?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.dealer.inventoryTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.dealer.inventorySubtitle')}</p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--primary" to="/inventory/new">
            {t('ops.dealer.newListing')}
          </Link>
        </div>
      </header>
      {error && <p style={{ color: 'var(--blox-ink)' }}>{(error as Error).message}</p>}
      {!items.length ? (
        <p className="blox-empty">{t('ops.dealer.noListings')}</p>
      ) : (
        <>
          <div className="blox-table-wrap">
            <table className="blox-table">
              <thead>
                <tr>
                  <th>{t('ops.col.vehicle')}</th>
                  <th>{t('ops.col.year')}</th>
                  <th>{t('ops.col.price')}</th>
                  <th>{t('ops.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/inventory/${p.id}`}>
                        {p.make} {p.model}
                      </Link>
                    </td>
                    <td>{p.modelYear}</td>
                    <td>
                      <span className="blox-money">
                        <MoneyText>{formatQar(Number(p.price))}</MoneyText>
                      </span>
                    </td>
                    <td>
                      <span className={`blox-pill blox-pill--${listingOpsPillVariant(p.listingStatus)}`}>
                        {listingStatus(p.listingStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="blox-pagination" style={{ marginTop: 12 }}>
            <span>{pagLabel(from, to, total)}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={from <= 1}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('ops.pagination.previous')}
              </button>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('ops.pagination.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InventoryEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [modelYear, setModelYear] = useState(2024);
  const [price, setPrice] = useState(100000);
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('used');
  const [engine, setEngine] = useState('');
  const [transmission, setTransmission] = useState<'automatic' | 'manual' | ''>('');
  const [cylinders, setCylinders] = useState<number | ''>('');
  const [drivetrain, setDrivetrain] = useState<'fwd' | 'rwd' | 'awd' | 'four_wd' | ''>('');
  const [bodyType, setBodyType] = useState<'sedan' | 'suv' | 'coupe' | 'hatchback' | 'pickup' | 'van' | 'other' | ''>('');
  const [color, setColor] = useState('');
  const [mileage, setMileage] = useState<number | ''>('');
  const [warrantyMonths, setWarrantyMonths] = useState<number | ''>('');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [financeEligible, setFinanceEligible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['dealer-inventory-item', id],
    queryFn: async () => {
      let offset = 0;
      const limit = 100;
      while (true) {
        const page = await apiFetch<{ total: number; items: Array<Record<string, unknown>> }>(
          `/api/dealer/inventory?limit=${limit}&offset=${offset}`,
        );
        const row = page.items.find((p) => p.id === id);
        if (row) return row;
        if (offset + limit >= page.total) return null;
        offset += limit;
      }
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew || !existing.data) return;
    const row = existing.data;
    if (!row) return;
    setMake(String(row.make ?? ''));
    setModel(String(row.model ?? ''));
    setTrim(String(row.trim ?? ''));
    setModelYear(Number(row.modelYear ?? 2024));
    setPrice(Number(row.price ?? 0));
    setDescription(String(row.description ?? ''));
    setCondition((row.condition as 'new' | 'used') ?? 'used');
    setEngine(String(row.engine ?? ''));
    setTransmission((row.transmission as 'automatic' | 'manual') ?? '');
    setCylinders(row.cylinders != null ? Number(row.cylinders) : '');
    setDrivetrain((row.drivetrain as typeof drivetrain) ?? '');
    setBodyType((row.bodyType as typeof bodyType) ?? '');
    setColor(String(row.color ?? ''));
    setMileage(row.mileage != null ? Number(row.mileage) : '');
    setWarrantyMonths(row.warrantyMonths != null ? Number(row.warrantyMonths) : '');
    setWarrantyNotes(String(row.warrantyNotes ?? ''));
    setFinanceEligible(row.financeEligible !== false);
  }, [existing.data, id, isNew]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        make,
        model,
        trim: trim || undefined,
        modelYear,
        price,
        description,
        condition,
        engine: engine || undefined,
        transmission: transmission || undefined,
        cylinders: cylinders === '' ? undefined : Number(cylinders),
        drivetrain: drivetrain || undefined,
        bodyType: bodyType || undefined,
        color: color || undefined,
        mileage: mileage === '' ? undefined : Number(mileage),
        warrantyMonths: warrantyMonths === '' ? undefined : Number(warrantyMonths),
        warrantyNotes: warrantyNotes || undefined,
        financeEligible,
      };
      if (isNew) {
        return apiFetch<{ id: string }>('/api/dealer/inventory', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      await apiFetch(`/api/dealer/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return { id: id as string };
    },
    onSuccess: (row: { id: string }) => {
      void qc.invalidateQueries({ queryKey: ['dealer-inventory'] });
      navigate(`/inventory/${row.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const publish = useMutation({
    mutationFn: () => apiFetch(`/api/dealer/inventory/${id}/publish`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-inventory'] }),
    onError: (e: Error) => setError(e.message),
  });

  const unpublish = useMutation({
    mutationFn: () => apiFetch(`/api/dealer/inventory/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-inventory'] }),
    onError: (e: Error) => setError(e.message),
  });

  const inventoryBusy = save.isPending || publish.isPending || unpublish.isPending;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || isNew || !id) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiFetch(`/api/dealer/inventory/${id}/images`, { method: 'POST', body: fd });
      void qc.invalidateQueries({ queryKey: ['dealer-inventory'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{isNew ? 'New listing' : 'Edit listing'}</h1>
          <p className="blox-page-header__subtitle">Vehicle details and financing eligibility</p>
        </div>
      </header>
      <form onSubmit={onSubmit} className="blox-form">
        <label>
          Make
          <input required value={make} onChange={(e) => setMake(e.target.value)} />
        </label>
        <label>
          Model
          <input required value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label>
          Trim
          <input value={trim} onChange={(e) => setTrim(e.target.value)} />
        </label>
        <label>
          Year
          <input type="number" required value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} />
        </label>
        <label>
          Condition
          <select value={condition} onChange={(e) => setCondition(e.target.value as 'new' | 'used')}>
            <option value="used">Used</option>
            <option value="new">New</option>
          </select>
        </label>
        <label>
          Transmission
          <select value={transmission} onChange={(e) => setTransmission(e.target.value as typeof transmission)}>
            <option value="">—</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label>
          Cylinders
          <input type="number" value={cylinders} onChange={(e) => setCylinders(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Drivetrain
          <select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value as typeof drivetrain)}>
            <option value="">—</option>
            <option value="fwd">FWD</option>
            <option value="rwd">RWD</option>
            <option value="awd">AWD</option>
            <option value="four_wd">4WD</option>
          </select>
        </label>
        <label>
          Body type
          <select value={bodyType} onChange={(e) => setBodyType(e.target.value as typeof bodyType)}>
            <option value="">—</option>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="coupe">Coupe</option>
            <option value="hatchback">Hatchback</option>
            <option value="pickup">Pickup</option>
            <option value="van">Van</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Engine
          <input value={engine} onChange={(e) => setEngine(e.target.value)} />
        </label>
        <label>
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          Mileage (km)
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Warranty months
          <input type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value ? Number(e.target.value) : '')} />
        </label>
        <label>
          Warranty notes
          <input value={warrantyNotes} onChange={(e) => setWarrantyNotes(e.target.value)} />
        </label>
        <label>
          Price (QAR)
          <input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={financeEligible}
            onChange={(e) => setFinanceEligible(e.target.checked)}
          />
          Finance eligible
        </label>
        {error && <p style={{ color: '#b42318', margin: 0 }}>{error}</p>}
        <button type="submit" className="blox-btn blox-btn--primary" disabled={inventoryBusy}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {!isNew && (
        <div className="blox-panel" style={{ maxWidth: 560 }}>
          <h2 className="blox-panel__title">Publish & media</h2>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
            Upload image
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            style={{ marginTop: 12 }}
            disabled={inventoryBusy}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="button"
            className="blox-btn blox-btn--ghost"
            style={{ marginTop: 12, marginLeft: 8 }}
            disabled={inventoryBusy}
            onClick={() => unpublish.mutate()}
          >
            {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
          </button>
          {error && error.includes('listing_has_active_financing') && (
            <p style={{ color: '#b42318', marginTop: 8 }}>
              This listing has an in-flight financing application and cannot be unpublished.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QuotesPage() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [negotiatedPrice, setNegotiatedPrice] = useState(90000);
  const [page, setPage] = useState(0);
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const inventory = useQuery({
    queryKey: ['dealer-inventory', 'quotes'],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          make: string;
          model: string;
          modelYear: number;
          price: string | number;
          listingStatus: string;
        }>;
      }>('/api/dealer/inventory?limit=100&offset=0'),
  });

  const quotes = useQuery({
    queryKey: ['dealer-quotes', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          url: string;
          customerEmail: string;
          negotiatedPrice: number;
          listPriceSnapshot: number;
          expiresAt: string;
          status: string;
          product: { make: string; model: string; modelYear: number };
        }>;
      }>(`/api/dealer/quotes?${buildPaginationQuery(page)}`),
  });
  const quoteItems = quotes.data?.items ?? [];
  const { from, to, total } = paginationWindow(quotes.data?.total ?? 0, page);

  const createQuote = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>('/api/dealer/quotes', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          customerEmail,
          negotiatedPrice,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      }),
    onSuccess: (row) => {
      setError(null);
      setCreatedUrl(row.url);
      void qc.invalidateQueries({ queryKey: ['dealer-quotes'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/dealer/quotes/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-quotes'] }),
    onError: (e: Error) => setError(e.message),
  });

  const published = (inventory.data?.items ?? []).filter((p) => p.listingStatus === 'published');

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);
    createQuote.mutate();
  }

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Customer quotes</h1>
          <p className="blox-page-header__subtitle">Send negotiated price links to customers</p>
        </div>
      </header>

      <section className="blox-panel" style={{ maxWidth: 560, marginBottom: 24 }}>
        <h2 className="blox-panel__title">Create quote</h2>
        <form onSubmit={onCreate} className="blox-form">
          <label>
            Published listing
            <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select vehicle</option>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.make} {p.model} {p.modelYear} — {Number(p.price).toLocaleString()} QAR
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer email
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </label>
          <label>
            Negotiated price (QAR)
            <input
              type="number"
              required
              min={1}
              value={negotiatedPrice}
              onChange={(e) => setNegotiatedPrice(Number(e.target.value))}
            />
          </label>
          <label>
            Expires
            <input
              type="datetime-local"
              required
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          {error && <p style={{ color: '#b42318', margin: 0 }}>{error}</p>}
          {createdUrl && (
            <p style={{ margin: 0, wordBreak: 'break-all' }}>
              Quote link:{' '}
              <a href={createdUrl} target="_blank" rel="noreferrer">
                {createdUrl}
              </a>
            </p>
          )}
          <button type="submit" className="blox-btn blox-btn--primary" disabled={createQuote.isPending}>
            Create quote link
          </button>
        </form>
      </section>

      {!quoteItems.length ? (
        <p className="blox-empty">No quotes yet.</p>
      ) : (
        <>
          <div className="blox-table-wrap">
            <table className="blox-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quoteItems.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.product.make} {q.product.model} {q.product.modelYear}
                    </td>
                    <td>{q.customerEmail}</td>
                    <td>
                      <span className="blox-money">
                        <MoneyText>{formatQar(q.negotiatedPrice)}</MoneyText>
                      </span>
                    </td>
                    <td>
                      <span className={`blox-pill blox-pill--${q.status === 'active' ? 'published' : 'draft'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>
                      <a href={q.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                    <td>
                      {q.status === 'active' && (
                        <button
                          type="button"
                          className="blox-btn blox-btn--ghost"
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate(q.id)}
                        >
                          {revoke.isPending ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="blox-pagination" style={{ marginTop: 12 }}>
            <span>
              Showing {from}–{to} of {total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={from <= 1}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Applications() {
  const { t, applicationStatus, pagination: pagLabel } = useOpsLabels();
  const [page, setPage] = useState(0);
  const { data } = useQuery({
    queryKey: ['dealer-apps', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          status: string;
          product: { make: string; model: string };
          customer: { name: string; email: string };
        }>;
      }>(`/api/dealer/applications?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.dealer.applicationsTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.dealer.applicationsSubtitle')}</p>
        </div>
      </header>
      {!items.length ? (
        <p className="blox-empty">{t('ops.common.noResults')}</p>
      ) : (
        <>
          <ul className="blox-list">
            {items.map((a) => (
              <li key={a.id}>
                {a.product.make} {a.product.model} — {a.customer.name} ({a.customer.email}) —{' '}
                <span className={`blox-pill blox-pill--${applicationOpsPillVariant(a.status)}`}>{applicationStatus(a.status)}</span>
              </li>
            ))}
          </ul>
          <div className="blox-pagination" style={{ marginTop: 12 }}>
            <span>
              Showing {from}–{to} of {total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={from <= 1}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CompanyPage() {
  const { t } = useOpsLabels();
  const { data, isLoading } = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch<CompanyProfile | null>('/api/companies/mine'),
  });
  const branding = (data?.branding ?? {}) as Record<string, string>;
  const rowStyle = { display: 'grid', gridTemplateColumns: '10rem 1fr', gap: 8, fontSize: '0.875rem' } as const;
  const labelStyle = { color: 'var(--blox-muted, #5b6b73)', fontWeight: 600 } as const;

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.dealer.companyTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.dealer.companySubtitle')}</p>
        </div>
      </header>
      {isLoading && <p>{t('ops.common.loading')}</p>}
      {!isLoading && !data && (
        <OpsEmptyState title={t('ops.dealer.companyEmpty')} />
      )}
      {data && (
        <section className="blox-panel">
          {data.logoUrl && (
            <img
              src={data.logoUrl}
              alt={data.name}
              style={{ maxHeight: 72, maxWidth: 200, objectFit: 'contain', marginBottom: 20 }}
            />
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.dealer.companyName')}</span>
              <span>{data.name}</span>
            </div>
            {data.code && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t('ops.dealer.companyCode')}</span>
                <span>{data.code}</span>
              </div>
            )}
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.dealer.companyStatus')}</span>
              <span>{data.status}</span>
            </div>
            {data.contactPhone && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t('ops.dealer.companyPhone')}</span>
                <span>{data.contactPhone}</span>
              </div>
            )}
            {data.contactEmail && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t('ops.dealer.companyEmail')}</span>
                <span>{data.contactEmail}</span>
              </div>
            )}
            {data.address && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t('ops.dealer.companyAddress')}</span>
                <span>{data.address}</span>
              </div>
            )}
            {(branding.primary || branding.accent) && (
              <>
                <h3 style={{ margin: '16px 0 8px', fontSize: '0.875rem' }}>{t('ops.dealer.companyBranding')}</h3>
                {branding.primary && (
                  <div style={rowStyle}>
                    <span style={labelStyle}>{t('ops.dealer.brandingPrimary')}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: branding.primary,
                          border: '1px solid var(--blox-border)',
                        }}
                      />
                      {branding.primary}
                    </span>
                  </div>
                )}
                {branding.accent && (
                  <div style={rowStyle}>
                    <span style={labelStyle}>{t('ops.dealer.brandingAccent')}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: branding.accent,
                          border: '1px solid var(--blox-border)',
                        }}
                      />
                      {branding.accent}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function App() {
  const { t } = useOpsLabels();
  const nav = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.dealer.nav.dashboard'), icon: 'home' },
      { to: '/inventory', label: t('ops.dealer.nav.inventory'), icon: 'inventory' },
      { to: '/quotes', label: t('ops.dealer.nav.quotes'), icon: 'quotes' },
      { to: '/applications', label: t('ops.dealer.nav.applications'), icon: 'apps' },
      { to: '/company', label: t('ops.dealer.nav.company'), icon: 'company' },
    ],
    [t],
  );

  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Dealer" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="dealer_agent" reasonParam="not_dealer">
            <BloxShell title="Dealer" nav={nav}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<InventoryList />} />
                <Route path="/inventory/new" element={<InventoryEditor />} />
                <Route path="/inventory/:id" element={<InventoryEditor />} />
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/company" element={<CompanyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BloxShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}

mountPortalApp({ sentryApp: 'dealer', authBootstrap: true, root: <App /> });
