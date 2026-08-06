import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AuthGuard,
  LoginPage,
  useAuthStore,
  BloxShell,
  bloxThemeWithBrand,
} from '@drivemarket/shared';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { OffersPage, PromotionsPage, PackagesPage } from './pages/EntityListPages';
import { LedgersPage } from './pages/LedgersPage';

const queryClient = new QueryClient();

const nav = [
  { to: '/main/dashboard', label: 'Dashboard' },
  { to: '/main/applications', label: 'Applications' },
  { to: '/main/products', label: 'Products' },
  { to: '/main/offers', label: 'Offers' },
  { to: '/main/promotions', label: 'Promotions' },
  { to: '/main/packages', label: 'Packages' },
  { to: '/main/ledgers', label: 'Ledgers' },
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
                <Route path="/main/promotions" element={<PromotionsPage />} />
                <Route path="/main/packages" element={<PackagesPage />} />
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
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
