import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  OpsShell,
  dmThemeWithBrand,
  useAuthStore,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

const queryClient = new QueryClient();
const nav = [
  { to: '/', label: 'Schedules' },
  { to: '/applications', label: 'Applications' },
];

function Page({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>{title}</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>
        Phase 0 scaffold — mark-paid and settlements in Phases 3–4. Activate is never available here.
      </p>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Finance portal" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="finance_officer" reasonParam="not_finance">
            <OpsShell title="Finance" nav={nav}>
              <Routes>
                <Route path="/" element={<Page title="Payment schedules" />} />
                <Route path="/applications" element={<Page title="Applications" />} />
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
