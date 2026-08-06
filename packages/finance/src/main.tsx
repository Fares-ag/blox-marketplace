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
  { to: '/', label: 'Schedules' },
  { to: '/applications', label: 'Applications' },
];

const scheduleRows = [
  { id: 'SCH-1102', customer: 'Sara Al-Mannai', vehicle: 'Toyota Camry SE', due: '2026-08-15', amount: 'QAR 2,940', status: 'pending' },
  { id: 'SCH-1101', customer: 'Ahmed Al-Kuwari', vehicle: 'Hyundai Tucson Limited', due: '2026-08-01', amount: 'QAR 3,590', status: 'paid' },
  { id: 'SCH-1100', customer: 'Fatima Al-Thani', vehicle: 'Kia Sportage GT', due: '2026-07-28', amount: 'QAR 2,610', status: 'paid' },
  { id: 'SCH-1099', customer: 'Khalid Al-Emadi', vehicle: 'BMW 320i M Sport', due: '2026-07-20', amount: 'QAR 5,120', status: 'pending' },
];

const appRows = [
  { id: 'APP-2400', customer: 'Sara Al-Mannai', status: 'approved', activated: 'Yes' },
  { id: 'APP-2398', customer: 'Fatima Al-Thani', status: 'approved', activated: 'Yes' },
  { id: 'APP-2397', customer: 'Khalid Al-Emadi', status: 'pending', activated: 'No' },
];

function SchedulesPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Payment schedules</h1>
          <p className="blox-page-header__subtitle">Mark paid and capture settlement references</p>
        </div>
        <div className="blox-page-header__actions">
          <button type="button" className="blox-btn blox-btn--secondary">
            Filter
          </button>
          <button type="button" className="blox-btn blox-btn--primary">
            Export
          </button>
        </div>
      </header>
      <div className="blox-filter-bar">
        <input type="date" defaultValue="2026-07-01" aria-label="From" />
        <input type="date" defaultValue="2026-08-31" aria-label="To" />
        <select defaultValue="">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Due</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scheduleRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.customer}</td>
                <td>{r.vehicle}</td>
                <td>{r.due}</td>
                <td>
                  <span className="blox-money">{r.amount}</span>
                </td>
                <td>
                  <span className={`blox-pill blox-pill--${r.status}`}>{r.status}</span>
                </td>
                <td>
                  {r.status === 'pending' ? (
                    <button type="button" className="blox-btn blox-btn--primary">
                      Mark paid
                    </button>
                  ) : (
                    <button type="button" className="blox-btn blox-btn--ghost">
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicationsPage() {
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>Applications</h1>
          <p className="blox-page-header__subtitle">Servicing view — activate is not available here</p>
        </div>
      </header>
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Activated</th>
            </tr>
          </thead>
          <tbody>
            {appRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.customer}</td>
                <td>
                  <span className={`blox-pill blox-pill--${r.status}`}>{r.status}</span>
                </td>
                <td>{r.activated}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Finance" homePath="/" />} />
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
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
