import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, Link, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  BloxShell,
  bloxThemeWithBrand,
  useAuthStore,
  apiFetch,
  getApiBase,
  ScrollToTop,
} from '@drivemarket/shared';

const queryClient = new QueryClient();
const nav = [
  { to: '/', label: 'Queue', icon: 'queue' as const },
  { to: '/applications', label: 'Applications', icon: 'apps' as const },
  { to: '/zoho-failures', label: 'Zoho failures', icon: 'logs' as const },
];

type AppDetail = {
  id: string;
  status: string;
  customerSnapshot?: Record<string, unknown>;
  pricingSnapshot?: Record<string, unknown>;
  rejectionReason?: string | null;
  resubmissionComment?: string | null;
  product?: { make: string; model: string; modelYear?: number };
  company?: { name: string };
  customer?: { name: string; email: string };
  documents?: Array<{ id: string; category: string; createdAt: string }>;
};

function statusVariant(status: string) {
  if (status === 'active' || status === 'completed') return 'approved';
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
  const [actionError, setActionError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<AppDetail>(`/api/applications/${id}`),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['app', id] });
    void qc.invalidateQueries({ queryKey: ['ops-apps'] });
  };

  const transition = useMutation({
    mutationFn: (toStatus: string) =>
      apiFetch(`/api/ops/applications/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, reason: reason.trim() || undefined }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const approveContract = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}/approve-contract`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const activate = useMutation({
    mutationFn: (direct?: boolean) =>
      apiFetch(`/api/ops/applications/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ direct: !!direct }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const status = data?.status ?? '';

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Application review</h1>
          <p className="blox-page-header__subtitle">
            {data?.product?.make} {data?.product?.model} · {data?.customer?.name}
          </p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--ghost" to="/">
            Back to queue
          </Link>
        </div>
      </header>

      {data && (
        <>
          <section className="blox-panel">
            <h2 className="blox-panel__title">Summary</h2>
            <p>
              Status: <span className={`blox-pill blox-pill--${statusVariant(status)}`}>{status}</span>
            </p>
            <p>Dealer: {data.company?.name}</p>
            <p>Customer email: {data.customer?.email}</p>
          </section>

          {(data.documents?.length ?? 0) > 0 && (
            <section className="blox-panel">
              <h2 className="blox-panel__title">KYC documents</h2>
              <ul>
                {data.documents!.map((doc) => (
                  <li key={doc.id}>
                    {doc.category}{' '}
                    <a
                      href={`${getApiBase()}/api/applications/${id}/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="blox-panel" style={{ maxWidth: 560 }}>
            <h2 className="blox-panel__title">Actions</h2>
            {actionError && <p style={{ color: '#b42318' }}>{actionError}</p>}
            <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
              Reason (required for reject / resubmission)
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              {status === 'under_review' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--primary"
                  disabled={approveContract.isPending}
                  onClick={() => approveContract.mutate()}
                >
                  Approve & send contract
                </button>
              )}
              {status === 'contracts_submitted' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--secondary"
                  onClick={() => transition.mutate('contract_under_review')}
                >
                  Start contract review
                </button>
              )}
              {status === 'contract_under_review' && (
                <>
                  <button
                    type="button"
                    className="blox-btn blox-btn--secondary"
                    onClick={() => transition.mutate('pending_finance_activation')}
                  >
                    Approve contract
                  </button>
                  <button
                    type="button"
                    className="blox-btn blox-btn--ghost"
                    onClick={() => transition.mutate('down_payment_required')}
                  >
                    Require down payment
                  </button>
                </>
              )}
              {status === 'pending_finance_activation' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--primary"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(false)}
                >
                  Activate financing
                </button>
              )}
              {status === 'under_review' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--ghost"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(true)}
                >
                  Direct activate
                </button>
              )}
              {['under_review', 'resubmission_required', 'contract_signing_required'].includes(status) && (
                <>
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
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ZohoFailuresPage() {
  const { data, error } = useQuery({
    queryKey: ['zoho-failures'],
    queryFn: () =>
      apiFetch<
        Array<{
          application_id: string;
          reason: string;
          status: string;
          customer_email: string;
          error: string | null;
        }>
      >('/api/ops/zoho/failures'),
  });

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Zoho sync failures</h1>
          <p className="blox-page-header__subtitle">Applications that failed CRM export</p>
        </div>
      </header>
      {error && <p style={{ color: '#b42318' }}>{(error as Error).message}</p>}
      {!data?.length ? (
        <p className="blox-empty">No CRM failures.</p>
      ) : (
        <div className="blox-table-wrap">
          <table className="blox-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.application_id}>
                  <td>
                    <Link to={`/applications/${row.application_id}`}>{row.application_id.slice(0, 8)}…</Link>
                  </td>
                  <td>{row.customer_email}</td>
                  <td>{row.status}</td>
                  <td>{row.error ?? row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">
            <BloxShell title="Credit" nav={nav}>
              <Routes>
                <Route path="/" element={<Queue />} />
                <Route path="/applications" element={<Queue />} />
                <Route path="/applications/:id" element={<Detail />} />
                <Route path="/zoho-failures" element={<ZohoFailuresPage />} />
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
          <ScrollToTop />
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
