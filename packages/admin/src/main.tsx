import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  useAuthStore,
  BloxShell,
  bloxThemeWithBrand,
  ScrollToTop,
  type BloxNavItem,
} from '@drivemarket/shared';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { OffersPage } from './pages/EntityListPages';
import { LedgersPage } from './pages/LedgersPage';

const queryClient = new QueryClient();

const nav: BloxNavItem[] = [
  { to: '/main/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/main/applications', label: 'Applications', icon: 'apps' },
  { to: '/main/products', label: 'Products', icon: 'products' },
  { to: '/main/offers', label: 'Offers', icon: 'offers' },
  { to: '/main/ledgers', label: 'Installments', icon: 'ledgers' },
];

function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Routes>
      <Route
        path="/auth/login"
        element={<LoginPage portalLabel="Blox Admin" homePath="/main/dashboard" />}
      />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="admin" reasonParam="not_admin">
            <BloxShell title="Admin" nav={nav} homePaths={['/main/dashboard']}>
              <Routes>
                <Route path="/" element={<Navigate to="/main/dashboard" replace />} />
                <Route path="/main/dashboard" element={<DashboardPage />} />
                <Route path="/main/applications" element={<ApplicationsPage />} />
                <Route path="/main/products" element={<ProductsPage />} />
                <Route path="/main/offers" element={<OffersPage />} />
                <Route path="/main/ledgers" element={<LedgersPage />} />
                <Route path="*" element={<Navigate to="/main/dashboard" replace />} />
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
