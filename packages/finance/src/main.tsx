import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
  OpsPageHeader,
  OpsStatusPill,
  OpsDataTable,
  OpsStatCard,
  OpsEmptyState,
  ScrollToTop,
  type BloxNavItem,
  type OpsPillVariant,
} from '@drivemarket/shared';

const queryClient = new QueryClient();
const nav: BloxNavItem[] = [
  { to: '/', label: 'Schedules', icon: 'finance' },
  { to: '/applications', label: 'Applications', icon: 'apps' },
];

type ScheduleRow = {
  id: string;
  application_id: string;
  application_status: string;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  sequence: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  effective_status: string;
  payment_reference: string | null;
};

function scheduleVariant(status: string): OpsPillVariant {
  if (status === 'paid') return 'approved';
  if (status === 'overdue') return 'rejected';
  return 'pending';
}

function SchedulesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [payTarget, setPayTarget] = useState<ScheduleRow | null>(null);
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [actionError, setActionError] = useState<string | null>(null);

  const query = statusFilter ? `&status=${statusFilter}` : '';
  const { data, error, isLoading } = useQuery({
    queryKey: ['schedules', statusFilter],
    queryFn: () =>
      apiFetch<{ total: number; items: ScheduleRow[] }>(
        `/api/ops/payment-schedules?limit=100${query}`,
      ),
  });

  const pay = useMutation({
    mutationFn: (payload: { id: string; method: string; reference: string }) =>
      apiFetch(`/api/ops/payment-schedules/${payload.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method: payload.method, reference: payload.reference || undefined }),
      }),
    onSuccess: () => {
      setPayTarget(null);
      setReference('');
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  const sweep = useMutation({
    mutationFn: () =>
      apiFetch<{ marked_overdue: number }>('/api/ops/payment-schedules/mark-overdue', {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
    onError: (e) => setActionError((e as Error).message),
  });

  const items = data?.items ?? [];
  const pending = items.filter((r) => r.effective_status === 'pending').length;
  const overdue = items.filter((r) => r.effective_status === 'overdue').length;
  const paid = items.filter((r) => r.status === 'paid').length;

  return (
    <div className="blox-page">
      <OpsPageHeader
        title="Payment schedules"
        subtitle="Record installments and capture settlement references"
        actions={
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            disabled={sweep.isPending}
            onClick={() => sweep.mutate()}
            title="Persist overdue status for schedules past their due date"
          >
            {sweep.isPending ? 'Sweeping…' : 'Run overdue sweep'}
          </button>
        }
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
      <div className="blox-stat-grid">
        <OpsStatCard label="Pending" value={String(pending)} />
        <OpsStatCard label="Overdue" value={String(overdue)} />
        <OpsStatCard label="Paid (loaded)" value={String(paid)} />
      </div>
      <div className="blox-filter-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </select>
      </div>
      <OpsDataTable
        columns={['Customer', 'Vehicle', 'Seq', 'Due', 'Amount', 'Remaining', 'Status', '']}
        empty={
          <OpsEmptyState
            title={isLoading ? 'Loading…' : 'No schedules'}
            body={isLoading ? '' : 'Activated financings will populate installment schedules here.'}
          />
        }
        rows={items.map((r) => [
          <span key="c" title={r.customer_email}>{r.customer_name ?? r.customer_email}</span>,
          r.vehicle,
          `${r.sequence}`,
          r.due_date,
          <span key="a" className="blox-money">QAR {r.amount.toLocaleString()}</span>,
          <span key="r" className="blox-money">QAR {r.remaining_amount.toLocaleString()}</span>,
          <OpsStatusPill key="s" label={r.effective_status} variant={scheduleVariant(r.effective_status)} />,
          r.effective_status === 'pending' || r.effective_status === 'overdue' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              onClick={() => {
                setActionError(null);
                setPayTarget(r);
              }}
            >
              Record payment
            </button>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.payment_reference ?? ''}</span>
          ),
        ])}
      />
      {payTarget && (
        <div className="blox-panel" style={{ marginTop: 16, padding: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>
            Record payment — installment {payTarget.sequence} · QAR{' '}
            {payTarget.remaining_amount.toLocaleString()}
          </h3>
          <p style={{ fontSize: '0.8125rem', margin: '4px 0 12px' }}>
            {payTarget.customer_name ?? payTarget.customer_email} · {payTarget.vehicle}
          </p>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
            Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cash">Cash at dealer</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 14 }}>
            Settlement reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank ref / receipt number"
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={pay.isPending}
              onClick={() => pay.mutate({ id: payTarget.id, method, reference })}
            >
              {pay.isPending ? 'Recording…' : 'Confirm full payment'}
            </button>
            <button type="button" className="blox-btn blox-btn--ghost" onClick={() => setPayTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function appVariant(status: string): OpsPillVariant {
  if (status === 'active' || status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function ApplicationsPage() {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['fin-apps'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          status: string;
          customer: { name: string; email: string };
          product: { make: string; model: string; modelYear: number };
          company: { name: string };
        }>
      >('/api/ops/applications'),
  });

  const transition = useMutation({
    mutationFn: (payload: { id: string; toStatus: string; reason?: string }) =>
      apiFetch(`/api/ops/applications/${payload.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus: payload.toStatus, reason: payload.reason }),
      }),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['fin-apps'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  return (
    <div className="blox-page">
      <OpsPageHeader
        title="Applications"
        subtitle="Down-payment confirmation and activation queue (activation itself is done by credit/admin)"
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
      <OpsDataTable
        columns={['Customer', 'Vehicle', 'Dealer', 'Status', '']}
        empty={<OpsEmptyState title="Queue clear" body="No applications in servicing states." />}
        rows={(data ?? []).map((a) => [
          a.customer.name,
          `${a.product.make} ${a.product.model}`,
          a.company.name,
          <OpsStatusPill key="s" label={a.status} variant={appVariant(a.status)} />,
          a.status === 'down_payment_required' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ id: a.id, toStatus: 'down_payment_submitted' })}
            >
              Down payment received
            </button>
          ) : a.status === 'down_payment_submitted' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ id: a.id, toStatus: 'pending_finance_activation' })}
            >
              Confirm &amp; queue activation
            </button>
          ) : null,
        ])}
      />
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Finance" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="finance_officer" reasonParam="not_finance">
            <BloxShell title="Finance" nav={nav}>
              <Routes>
                <Route path="/" element={<SchedulesPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
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
