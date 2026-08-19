import { StrictMode, useEffect, useState, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, Link, useParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  BloxShell,
  bloxThemeWithBrand,
  useAuthStore,
  apiFetch,
  formatQar,
  MoneyText,
} from '@drivemarket/shared';

const queryClient = new QueryClient();

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/applications', label: 'Applications' },
  { to: '/company', label: 'Company' },
];

function statusVariant(status: string) {
  if (status === 'published') return 'published';
  if (status === 'draft') return 'draft';
  if (status === 'reserved') return 'reserved';
  if (status === 'sold') return 'sold';
  return 'pending';
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ['dealer-inventory'],
    queryFn: () => apiFetch<Array<{ listingStatus: string }>>('/api/dealer/inventory'),
  });
  const counts = {
    draft: data?.filter((p) => p.listingStatus === 'draft').length ?? 0,
    published: data?.filter((p) => p.listingStatus === 'published').length ?? 0,
    reserved: data?.filter((p) => p.listingStatus === 'reserved').length ?? 0,
    sold: data?.filter((p) => p.listingStatus === 'sold').length ?? 0,
  };
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Dealer dashboard</h1>
          <p className="blox-page-header__subtitle">Inventory snapshot for your showroom</p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--primary" to="/inventory/new">
            Create listing
          </Link>
        </div>
      </header>
      <div className="blox-stat-grid">
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Draft</p>
          <p className="blox-stat-card__value blox-money">{counts.draft}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Published</p>
          <p className="blox-stat-card__value blox-money">{counts.published}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Reserved</p>
          <p className="blox-stat-card__value blox-money">{counts.reserved}</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Sold</p>
          <p className="blox-stat-card__value blox-money">{counts.sold}</p>
        </article>
      </div>
    </div>
  );
}

function InventoryList() {
  const { data, error } = useQuery({
    queryKey: ['dealer-inventory'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          make: string;
          model: string;
          modelYear: number;
          price: string | number;
          listingStatus: string;
        }>
      >('/api/dealer/inventory'),
  });
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Inventory</h1>
          <p className="blox-page-header__subtitle">Manage listings for your dealership</p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--primary" to="/inventory/new">
            New listing
          </Link>
        </div>
      </header>
      {error && <p style={{ color: 'var(--blox-ink)' }}>{(error as Error).message}</p>}
      {!data?.length ? (
        <p className="blox-empty">No listings yet.</p>
      ) : (
        <div className="blox-table-wrap">
          <table className="blox-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Year</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
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
                    <span className={`blox-pill blox-pill--${statusVariant(p.listingStatus)}`}>
                      {p.listingStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    queryKey: ['dealer-inventory'],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>('/api/dealer/inventory'),
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew || !existing.data) return;
    const row = existing.data.find((p) => p.id === id);
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
        <button type="submit" className="blox-btn blox-btn--primary">
          Save
        </button>
      </form>
      {!isNew && (
        <div className="blox-panel" style={{ maxWidth: 560 }}>
          <h2 className="blox-panel__title">Publish & media</h2>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
            Upload image
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <button type="button" className="blox-btn blox-btn--secondary" style={{ marginTop: 12 }} onClick={() => publish.mutate()}>
            Publish
          </button>
          <button type="button" className="blox-btn blox-btn--ghost" style={{ marginTop: 12, marginLeft: 8 }} onClick={() => unpublish.mutate()}>
            Unpublish
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
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const inventory = useQuery({
    queryKey: ['dealer-inventory'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          make: string;
          model: string;
          modelYear: number;
          price: string | number;
          listingStatus: string;
        }>
      >('/api/dealer/inventory'),
  });

  const quotes = useQuery({
    queryKey: ['dealer-quotes'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          url: string;
          customerEmail: string;
          negotiatedPrice: number;
          listPriceSnapshot: number;
          expiresAt: string;
          status: string;
          product: { make: string; model: string; modelYear: number };
        }>
      >('/api/dealer/quotes'),
  });

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

  const published = (inventory.data ?? []).filter((p) => p.listingStatus === 'published');

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

      {!quotes.data?.length ? (
        <p className="blox-empty">No quotes yet.</p>
      ) : (
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
              {quotes.data.map((q) => (
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
                        onClick={() => revoke.mutate(q.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Applications() {
  const { data } = useQuery({
    queryKey: ['dealer-apps'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          status: string;
          product: { make: string; model: string };
          customer: { name: string; email: string };
        }>
      >('/api/dealer/applications'),
  });
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Applications</h1>
          <p className="blox-page-header__subtitle">Read-only financing status on your stock</p>
        </div>
      </header>
      {!data?.length ? (
        <p className="blox-empty">No applications yet.</p>
      ) : (
        <ul className="blox-list">
          {data.map((a) => (
            <li key={a.id}>
              {a.product.make} {a.product.model} — {a.customer.name} ({a.customer.email}) —{' '}
              <span className={`blox-pill blox-pill--${statusVariant(a.status)}`}>{a.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompanyPage() {
  const { data } = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch('/api/companies/mine'),
  });
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Company</h1>
          <p className="blox-page-header__subtitle">Your dealership profile</p>
        </div>
      </header>
      <section className="blox-panel">
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Dealer" homePath="/" />} />
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={bloxThemeWithBrand}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
