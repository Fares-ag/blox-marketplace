import { useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TwoFactorLoginPage,
  MfaSetupPage,
  BloxShell,
  mountPortalApp,
  type BloxNavItem,
} from '@drivemarket/shared';import '@drivemarket/shared/styles/global.scss';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { OffersPage } from './pages/EntityListPages';
import { LedgersPage } from './pages/LedgersPage';

function App() {
  const { t } = useTranslation();
  const navItems = useMemo<BloxNavItem[]>(
    () => [
      { to: '/main/dashboard', label: t('ops.admin.nav.dashboard'), icon: 'home' },
      { to: '/main/applications', label: t('ops.admin.nav.applications'), icon: 'apps' },
      { to: '/main/products', label: t('ops.admin.nav.products'), icon: 'products' },
      { to: '/main/offers', label: t('ops.admin.nav.offers'), icon: 'offers' },
      { to: '/main/ledgers', label: t('ops.admin.nav.ledgers'), icon: 'ledgers' },
    ],
    [t],
  );

  return (    <Routes>
      <Route
        path="/auth/login"
        element={<LoginPage portalLabel="Blox Admin" homePath="/main/dashboard" />}
      />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/auth/two-factor"
        element={<TwoFactorLoginPage portalLabel="Blox Admin" homePath="/main/dashboard" />}
      />
      <Route
        path="/auth/mfa-setup"
        element={<MfaSetupPage portalLabel="Blox Admin" homePath="/main/dashboard" />}
      />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="admin" reasonParam="not_admin">
            <BloxShell title="Admin" nav={navItems} homePaths={['/main/dashboard']}>              <Routes>
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

mountPortalApp({ sentryApp: 'admin', authBootstrap: true, root: <App /> });
