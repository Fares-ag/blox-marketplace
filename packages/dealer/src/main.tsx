import { StrictMode, useEffect, useState, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, Link, useParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  OpsShell,
  dmThemeWithBrand,
  useAuthStore,
  apiFetch,
  formatQar,
  MoneyText,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

const queryClient = new QueryClient();

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/applications', label: 'Applications' },
  { to: '/company', label: 'Company' },
];

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
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Dealer dashboard</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>
        Draft {counts.draft} · Published {counts.published} · Reserved {counts.reserved} · Sold{' '}
        {counts.sold}
      </p>
      <Link to="/inventory/new">Create listing</Link>
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Inventory</h1>
        <Link className="dm-btn-cta" to="/inventory/new" style={{ minHeight: 40, padding: '0 16px' }}>
          New listing
        </Link>
      </div>
      {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}
      {!data?.length && <p style={{ color: 'var(--dm-slate-600)' }}>No listings yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Vehicle</th>
            <th align="left">Year</th>
            <th align="right">Price</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.id}>
              <td>
                <Link to={`/inventory/${p.id}`}>
                  {p.make} {p.model}
                </Link>
              </td>
              <td>{p.modelYear}</td>
              <td align="right">
                <MoneyText>{formatQar(Number(p.price))}</MoneyText>
              </td>
              <td>{p.listingStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [modelYear, setModelYear] = useState(2024);
  const [price, setPrice] = useState(100000);
  const [description, setDescription] = useState('');
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
    setModelYear(Number(row.modelYear ?? 2024));
    setPrice(Number(row.price ?? 0));
    setDescription(String(row.description ?? ''));
  }, [existing.data, id, isNew]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { make, model, modelYear, price, description, condition: 'used' };
      if (isNew) {
        return apiFetch<{ id: string }>('/api/dealer/inventory', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      return apiFetch(`/api/dealer/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
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
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>
        {isNew ? 'New listing' : 'Edit listing'}
      </h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <label>
          Make
          <input required value={make} onChange={(e) => setMake(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 40 }} />
        </label>
        <label>
          Model
          <input required value={model} onChange={(e) => setModel(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 40 }} />
        </label>
        <label>
          Year
          <input type="number" required value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} style={{ display: 'block', width: '100%', minHeight: 40 }} />
        </label>
        <label>
          Price (QAR)
          <input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ display: 'block', width: '100%', minHeight: 40 }} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ display: 'block', width: '100%' }} />
        </label>
        {error && <p style={{ color: 'var(--dm-danger)' }}>{error}</p>}
        <button type="submit" className="dm-btn-cta">
          Save
        </button>
      </form>
      {!isNew && (
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <label>
            Upload image
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <button type="button" className="dm-btn-cta" onClick={() => publish.mutate()}>
            Publish
          </button>
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
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Applications on my stock</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>Read-only financing status.</p>
      <ul>
        {data?.map((a) => (
          <li key={a.id}>
            {a.product.make} {a.product.model} — {a.customer.name} ({a.customer.email}) — {a.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompanyPage() {
  const { data } = useQuery({
    queryKey: ['company-mine'],
    queryFn: () => apiFetch('/api/companies/mine'),
  });
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Company</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Dealer portal" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="dealer_agent" reasonParam="not_dealer">
            <OpsShell title="Dealer" nav={nav}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<InventoryList />} />
                <Route path="/inventory/new" element={<InventoryEditor />} />
                <Route path="/inventory/:id" element={<InventoryEditor />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/company" element={<CompanyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </OpsShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={dmThemeWithBrand}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
