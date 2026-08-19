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
} from '@drivemarket/shared';

const queryClient = new QueryClient();
const nav: BloxNavItem[] = [
  { to: '/', label: 'Users', icon: 'users' },
  { to: '/companies', label: 'Companies', icon: 'company' },
  { to: '/activity-logs', label: 'Activity logs', icon: 'logs' },
  { to: '/system', label: 'System', icon: 'system' },
];

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  isActive: boolean;
  emailVerified: boolean;
};

const ASSIGNABLE_ROLES = [
  'customer',
  'dealer_agent',
  'credit_officer',
  'finance_officer',
  'admin',
  'super_admin',
];

function UsersPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<{ id: string; role: string } | null>(null);

  const { data, error } = useQuery({
    queryKey: ['sa-users'],
    queryFn: () => apiFetch<UserRow[]>('/api/users'),
  });

  const update = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/users/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setActionError(null);
      setRoleEdit(null);
      void qc.invalidateQueries({ queryKey: ['sa-users'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  return (
    <div className="blox-page">
      <OpsPageHeader title="Users & roles" subtitle="Suspend accounts and assign roles" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
      <OpsDataTable
        columns={['Email', 'Name', 'Role', 'Status', '']}
        empty={<OpsEmptyState title="No users" body="" />}
        rows={(data ?? []).map((u) => [
          u.email,
          u.name,
          roleEdit?.id === u.id ? (
            <span key="r" style={{ display: 'inline-flex', gap: 6 }}>
              <select
                value={roleEdit.role}
                onChange={(e) => setRoleEdit({ id: u.id, role: e.target.value })}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="blox-btn blox-btn--primary"
                style={{ padding: '2px 10px' }}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: u.id, body: { role: roleEdit.role } })}
              >
                Save
              </button>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                style={{ padding: '2px 10px' }}
                onClick={() => setRoleEdit(null)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <span key="r" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <OpsStatusPill label={u.role} variant="active" />
              {u.id !== me?.id && (
                <button
                  type="button"
                  className="blox-btn blox-btn--ghost"
                  style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                  onClick={() => setRoleEdit({ id: u.id, role: u.role })}
                >
                  Change
                </button>
              )}
            </span>
          ),
          <OpsStatusPill
            key="s"
            label={u.isActive ? 'active' : 'suspended'}
            variant={u.isActive ? 'approved' : 'rejected'}
          />,
          u.id !== me?.id ? (
            <button
              key="b"
              type="button"
              className={`blox-btn ${u.isActive ? 'blox-btn--danger' : 'blox-btn--primary'}`}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: u.id, body: { isActive: !u.isActive } })}
            >
              {u.isActive ? 'Suspend' : 'Reactivate'}
            </button>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.6 }}>you</span>
          ),
        ])}
      />
    </div>
  );
}

function CompaniesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data, error } = useQuery({
    queryKey: ['sa-companies'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          name: string;
          code: string | null;
          status: string;
          allowDirectActivate: boolean;
          canPay: boolean;
        }>
      >('/api/companies/all'),
  });

  const updateCompany = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, boolean> }) =>
      apiFetch(`/api/companies/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sa-companies'] }),
    onError: (e: Error) => setMsg(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name, code: code || undefined }),
      }),
    onSuccess: () => {
      setMsg('Company created');
      setName('');
      setCode('');
      void qc.invalidateQueries({ queryKey: ['sa-companies'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="blox-page">
      <OpsPageHeader title="Companies" subtitle="Cross-tenant oversight" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <section className="blox-panel" style={{ maxWidth: 480, marginBottom: 24 }}>
        <h2 className="blox-panel__title">Create company</h2>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem' }}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem', marginTop: 12 }}>
          Code
          <input value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        <button
          type="button"
          className="blox-btn blox-btn--primary"
          style={{ marginTop: 12 }}
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Create
        </button>
      </section>
      <OpsDataTable
        columns={['Name', 'Code', 'Status', 'Direct activate', 'SkipCash pay']}
        empty={<OpsEmptyState title="No companies" body="" />}
        rows={(data ?? []).map((c) => [
          c.name,
          c.code ?? '—',
          <OpsStatusPill key="s" label={c.status} variant={c.status === 'active' ? 'approved' : 'draft'} />,
          <button
            key="da"
            type="button"
            className="blox-btn blox-btn--ghost"
            disabled={updateCompany.isPending}
            onClick={() =>
              updateCompany.mutate({
                id: c.id,
                body: { allowDirectActivate: !c.allowDirectActivate },
              })
            }
          >
            {c.allowDirectActivate ? 'Enabled' : 'Off'}
          </button>,
          <button
            key="cp"
            type="button"
            className="blox-btn blox-btn--ghost"
            disabled={updateCompany.isPending}
            onClick={() =>
              updateCompany.mutate({
                id: c.id,
                body: { canPay: !c.canPay },
              })
            }
          >
            {c.canPay ? 'Enabled' : 'Off'}
          </button>,
        ])}
      />
    </div>
  );
}

function ActivityLogsPage() {
  const { data, error } = useQuery({
    queryKey: ['sa-logs'],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          actor_email: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          from_value: string | null;
          to_value: string | null;
          created_at: string;
        }>;
      }>('/api/ops/activity-logs?limit=100'),
  });
  return (
    <div className="blox-page">
      <OpsPageHeader title="Activity logs" subtitle="Audit trail across ops actions" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <OpsDataTable
        columns={['When', 'Actor', 'Action', 'Entity', 'Change']}
        empty={<OpsEmptyState title="No activity yet" body="Actions across the platform appear here." />}
        rows={(data?.items ?? []).map((l) => [
          new Date(l.created_at).toLocaleString(),
          l.actor_email ?? 'system',
          l.action,
          `${l.entity_type}:${l.entity_id.slice(0, 8)}`,
          l.from_value || l.to_value ? `${l.from_value ?? ''} → ${l.to_value ?? ''}` : '—',
        ])}
      />
    </div>
  );
}

function SystemPage() {
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['sa-metrics'],
    queryFn: () =>
      apiFetch<{
        users_total: number;
        customers_total: number;
        companies_active: number;
        products_published: number;
        applications_by_status: Record<string, number>;
        schedules_pending: number;
        schedules_overdue: number;
      }>('/api/ops/metrics'),
  });
  const active = data?.applications_by_status?.active ?? 0;
  const underReview = data?.applications_by_status?.under_review ?? 0;
  return (
    <div className="blox-page">
      <OpsPageHeader title="System" subtitle="Live platform metrics" />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      <div className="blox-stat-grid">
        <OpsStatCard label="Users" value={String(data?.users_total ?? '—')} delta={`${data?.customers_total ?? 0} customers`} />
        <OpsStatCard label="Active dealers" value={String(data?.companies_active ?? '—')} />
        <OpsStatCard label="Published vehicles" value={String(data?.products_published ?? '—')} />
        <OpsStatCard label="Applications in review" value={String(underReview)} delta={`${active} active financings`} />
        <OpsStatCard label="Installments pending" value={String(data?.schedules_pending ?? '—')} delta={`${data?.schedules_overdue ?? 0} overdue`} />
      </div>
      <section className="blox-panel" style={{ marginTop: 24, maxWidth: 520 }}>
        <h2 className="blox-panel__title">Production seeds</h2>
        <p style={{ fontSize: '0.875rem', opacity: 0.85 }}>
          Idempotent ops — safe to run more than once.
        </p>
        {seedMsg && <p>{seedMsg}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            onClick={() =>
              apiFetch('/api/ops/seed-finance-partners', { method: 'POST' })
                .then((r) => setSeedMsg(JSON.stringify(r)))
                .catch((e: Error) => setSeedMsg(e.message))
            }
          >
            Seed finance partners
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Super Admin" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="super_admin" reasonParam="not_super_admin">
            <BloxShell title="Super Admin" nav={nav}>
              <Routes>
                <Route path="/" element={<UsersPage />} />
                <Route path="/companies" element={<CompaniesPage />} />
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
                <Route path="/system" element={<SystemPage />} />
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
