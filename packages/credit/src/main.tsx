import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  OpsShell,
  dmThemeWithBrand,
  useAuthStore,
  apiFetch,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

const queryClient = new QueryClient();
const nav = [
  { to: '/', label: 'Queue' },
  { to: '/applications', label: 'Applications' },
];

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
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Credit queue</h1>
      {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}
      {!data?.length && <p style={{ color: 'var(--dm-slate-600)' }}>Queue clear.</p>}
      <ul>
        {data?.map((a) => (
          <li key={a.id}>
            <a href={`/applications/${a.id}`}>
              {a.product.make} {a.product.model} — {a.customer.name} — {a.status} ({a.company.name})
            </a>
          </li>
        ))}
      </ul>
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
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>Application</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
      <label>
        Reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 40 }} />
      </label>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button type="button" onClick={() => transition.mutate('resubmission_required')}>
          Request resubmission
        </button>
        <button type="button" style={{ color: 'var(--dm-danger)' }} onClick={() => transition.mutate('rejected')}>
          Reject
        </button>
      </div>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Credit portal" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">
            <OpsShell title="Credit" nav={nav}>
              <Routes>
                <Route path="/" element={<Queue />} />
                <Route path="/applications" element={<Queue />} />
                <Route path="/applications/:id" element={<Detail />} />
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
