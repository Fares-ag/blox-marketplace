import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, Link, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  BloxShell,
  bloxThemeWithBrand,
  useAuthStore,
  apiFetch,
} from '@drivemarket/shared';

const queryClient = new QueryClient();
const nav = [
  { to: '/', label: 'Queue' },
  { to: '/applications', label: 'Applications' },
];

function statusVariant(status: string) {
  if (status === 'approved' || status === 'activated') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'resubmission_required') return 'pending';
  return 'pending';
}

function Queue() {
  const { data, error } = useQuery({
    queryKey: ['ops-apps'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          status: string;
          customer: { name: string; email: string };
          product: { make: string; model: string };
          company: { name: string };
        }>
      >('/api/ops/applications'),
  });
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Credit queue</h1>
          <p className="blox-page-header__subtitle">Applications awaiting underwriting review</p>
        </div>
      </header>
      {error && <p style={{ color: '#b42318' }}>{(error as Error).message}</p>}
      {!data?.length ? (
        <p className="blox-empty">Queue clear.</p>
      ) : (
        <div className="blox-table-wrap">
          <table className="blox-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Customer</th>
                <th>Dealer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/applications/${a.id}`}>
                      {a.product.make} {a.product.model}
                    </Link>
                  </td>
                  <td>{a.customer.name}</td>
                  <td>{a.company.name}</td>
                  <td>
                    <span className={`blox-pill blox-pill--${statusVariant(a.status)}`}>{a.status}</span>
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

function Detail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const { data } = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch(`/api/applications/${id}`),
    enabled: !!id,
  });
  const transition = useMutation({
    mutationFn: (toStatus: string) =>
      apiFetch(`/api/ops/applications/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, reason }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['ops-apps'] });
    },
  });

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Application</h1>
          <p className="blox-page-header__subtitle">Review and transition underwriting status</p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--ghost" to="/">
            Back to queue
          </Link>
        </div>
      </header>
      <section className="blox-panel">
        <h2 className="blox-panel__title">Record</h2>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </section>
      <section className="blox-panel" style={{ maxWidth: 560 }}>
        <h2 className="blox-panel__title">Actions</h2>
        <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            onClick={() => transition.mutate('resubmission_required')}
          >
            Request resubmission
          </button>
          <button
            type="button"
            className="blox-btn blox-btn--danger"
            onClick={() => transition.mutate('rejected')}
          >
            Reject
          </button>
        </div>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Credit" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">
            <BloxShell title="Credit" nav={nav}>
              <Routes>
                <Route path="/" element={<Queue />} />
                <Route path="/applications" element={<Queue />} />
                <Route path="/applications/:id" element={<Detail />} />
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
