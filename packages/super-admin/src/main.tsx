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
  { to: '/', label: 'Users' },
  { to: '/companies', label: 'Companies' },
  { to: '/activity-logs', label: 'Activity logs' },
  { to: '/system', label: 'System' },
];

function Page({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>{title}</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>Phase 0 scaffold — audit export in later phases.</p>
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
        element={<LoginPage portalLabel="Super-admin portal" homePath="/" />}
      />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="super_admin" reasonParam="not_super_admin">
            <OpsShell title="Super Admin" nav={nav}>
              <Routes>
                <Route path="/" element={<Page title="Users & roles" />} />
                <Route path="/companies" element={<Page title="Companies" />} />
                <Route path="/activity-logs" element={<Page title="Activity logs" />} />
                <Route path="/system" element={<Page title="System" />} />
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
