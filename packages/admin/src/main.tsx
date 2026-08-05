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
  { to: '/', label: 'Companies' },
  { to: '/users', label: 'Users' },
  { to: '/offers', label: 'Offers' },
  { to: '/products', label: 'Products' },
  { to: '/applications', label: 'Applications' },
  { to: '/settings', label: 'Settings' },
];

function Page({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--dm-font-display)', marginTop: 0 }}>{title}</h1>
      <p style={{ color: 'var(--dm-slate-600)' }}>Phase 0 scaffold — company/dealer invite in Phase 1.</p>
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
      <Route path="/auth/login" element={<LoginPage portalLabel="Admin portal" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="admin" reasonParam="not_admin">
            <OpsShell title="Admin" nav={nav}>
              <Routes>
                <Route path="/" element={<Page title="Companies" />} />
                <Route path="/users" element={<Page title="Users" />} />
                <Route path="/offers" element={<Page title="Offers" />} />
                <Route path="/products" element={<Page title="Products" />} />
                <Route path="/applications" element={<Page title="Applications" />} />
                <Route path="/settings" element={<Page title="Settings" />} />
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
