import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  BloxShell,
  bloxThemeWithBrand,
  useAuthStore,
} from '@drivemarket/shared';

const queryClient = new QueryClient();
const nav = [
  { to: '/', label: 'Users' },
  { to: '/companies', label: 'Companies' },
  { to: '/activity-logs', label: 'Activity logs' },
  { to: '/system', label: 'System' },
];

const users = [
  { email: 'admin@drivemarket.local', role: 'admin', company: '—' },
  { email: 'dealer@drivemarket.local', role: 'dealer_agent', company: 'Gulf Motors Demo' },
  { email: 'credit@drivemarket.local', role: 'credit_officer', company: '—' },
  { email: 'finance@drivemarket.local', role: 'finance_officer', company: '—' },
  { email: 'super@drivemarket.local', role: 'super_admin', company: '—' },
];

const companies = [
  { name: 'Gulf Motors Demo', code: 'GULF', status: 'active', published: 4 },
  { name: 'Doha Auto Gallery', code: 'DAG', status: 'draft', published: 0 },
];

const logs = [
  { at: '2026-08-05 21:14', actor: 'admin@drivemarket.local', action: 'company.update', detail: 'GULF can_pay=true' },
  { at: '2026-08-05 18:02', actor: 'credit@drivemarket.local', action: 'application.transition', detail: 'APP-2400 → approved' },
  { at: '2026-08-04 11:40', actor: 'dealer@drivemarket.local', action: 'product.publish', detail: 'hyundai-tucson-limited' },
];

function UsersPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Users & roles</h1>
          <p className="blox-page-header__subtitle">Assign roles including super_admin</p>
        </div>
        <div className="blox-page-header__actions">
          <button type="button" className="blox-btn blox-btn--primary">
            Invite user
          </button>
        </div>
      </header>
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Company</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td>
                  <span className="blox-pill blox-pill--active">{u.role}</span>
                </td>
                <td>{u.company}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompaniesPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Companies</h1>
          <p className="blox-page-header__subtitle">Cross-tenant oversight</p>
        </div>
      </header>
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Status</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.code}>
                <td>{c.name}</td>
                <td>{c.code}</td>
                <td>
                  <span className={`blox-pill blox-pill--${c.status === 'active' ? 'active' : 'draft'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="blox-money">{c.published}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityLogsPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Activity logs</h1>
          <p className="blox-page-header__subtitle">Audit trail across ops actions</p>
        </div>
        <div className="blox-page-header__actions">
          <button type="button" className="blox-btn blox-btn--primary">
            Export
          </button>
        </div>
      </header>
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={`${l.at}-${l.action}`}>
                <td>{l.at}</td>
                <td>{l.actor}</td>
                <td>{l.action}</td>
                <td>{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>System</h1>
          <p className="blox-page-header__subtitle">Feature flags and monitoring links</p>
        </div>
      </header>
      <div className="blox-stat-grid">
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">API</p>
          <p className="blox-stat-card__value">Healthy</p>
          <p className="blox-stat-card__delta">localhost:3010</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Payments</p>
          <p className="blox-stat-card__value">Sandbox</p>
          <p className="blox-stat-card__delta">SkipCash</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Featured listings</p>
          <p className="blox-stat-card__value">Off</p>
          <p className="blox-stat-card__delta">Flag disabled</p>
        </article>
        <article className="blox-stat-card">
          <p className="blox-stat-card__label">Can pay default</p>
          <p className="blox-stat-card__value">On</p>
          <p className="blox-stat-card__delta">New dealers</p>
        </article>
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
      <Route
        path="/auth/login"
        element={<LoginPage portalLabel="Blox Super Admin" homePath="/" />}
      />
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
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
