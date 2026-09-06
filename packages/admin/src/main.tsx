import { lazy, Suspense, useMemo } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TwoFactorLoginPage,
  MfaSetupPage,
  BloxShell,
  PortalBasePathProvider,
  OpsAppFrame,
  AddApplicationWizard,
  ApplicationWorkspace,
  PageSkeleton,
  mountPortalApp,
  type BloxNavItem,
  useNavCounts,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ProductsPage, ProductEditPage } from './pages/ProductsPage';
import { OffersPage, OfferEditPage } from './pages/EntityListPages';
import { LedgersPage } from './pages/LedgersPage';
import { BankTransfersPage } from './pages/BankTransfersPage';
import { UsersPage, UserDetailPage } from './pages/UsersPages';
import { CompaniesPage } from './pages/CompaniesPage';
const PromotionsPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.PromotionsPage })));
const PromotionEditPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.PromotionEditPage })));
const InsuranceRatesPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.InsuranceRatesPage })));
const InsuranceRateEditPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.InsuranceRateEditPage })));
const PackagesPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.PackagesPage })));
const PackageEditPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.PackageEditPage })));
const SettlementSettingsPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.SettlementSettingsPage })));
const ClearStoragePage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.ClearStoragePage })));

function AdminWorkspace() {
  const { id } = useParams();
  if (!id) return <Navigate to="/main/applications" replace />;
  return <ApplicationWorkspace id={id} audience="admin" backTo="/main/applications" />;
}

function App() {
  const { t } = useTranslation();
  const counts = useNavCounts<{ applications_by_status?: Record<string, number>; schedules_overdue?: number }>('/api/ops/metrics');
  const navItems = useMemo<BloxNavItem[]>(() => {
    const operations = t('ops.shell.groupOperations');
    const people = t('ops.shell.groupPeople');
    const catalog = t('ops.shell.groupCatalog');
    const platform = t('ops.shell.groupPlatform');
    return [
      { to: '/main/dashboard', label: t('ops.admin.nav.dashboard'), icon: 'home', group: operations },
      { to: '/main/applications', label: t('ops.admin.nav.applications'), icon: 'apps', group: operations, count: counts?.applications_by_status?.under_review },
      { to: '/main/bank-transfers', label: t('ops.admin.nav.bankTransfers'), icon: 'finance', group: operations },
      { to: '/main/ledgers', label: t('ops.admin.nav.ledgers'), icon: 'ledgers', group: operations, count: counts?.schedules_overdue },
      { to: '/main/users', label: t('ops.admin.nav.users'), icon: 'users', group: people },
      { to: '/main/companies', label: t('ops.admin.nav.companies'), icon: 'company', group: people },
      { to: '/main/vehicles', label: t('ops.admin.nav.vehicles'), icon: 'products', group: catalog },
      { to: '/main/offers', label: t('ops.admin.nav.offers'), icon: 'offers', group: catalog },
      { to: '/main/promotions', label: t('ops.admin.nav.promotions'), icon: 'promotions', group: catalog },
      { to: '/main/insurance-rates', label: t('ops.admin.nav.insurance'), icon: 'insurance', group: catalog },
      { to: '/main/packages', label: t('ops.admin.nav.packages'), icon: 'packages', group: catalog },
      { to: '/main/settings/settlement-discounts', label: t('ops.admin.nav.settings'), icon: 'settings', group: platform },
    ];
  }, [t, counts]);

  return (
    <OpsAppFrame>
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalKey="admin" homePath="/main/dashboard" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage portalKey="admin" />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage portalKey="admin" />} />
      <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="admin" homePath="/main/dashboard" />} />
      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="admin" homePath="/main/dashboard" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole={['admin', 'super_admin', 'group_admin']} reasonParam="not_admin">
            <PortalBasePathProvider basePath="/main">
            <BloxShell title="Admin" nav={navItems} homePaths={['/main/dashboard']} searchPath="/applications">
              <Suspense fallback={<PageSkeleton variant="dashboard" />}>
              <Routes>
                <Route path="/" element={<Navigate to="/main/dashboard" replace />} />
                <Route path="/main/dashboard" element={<DashboardPage />} />
                <Route path="/main/applications" element={<ApplicationsPage />} />
                <Route path="/main/applications/new" element={<AddApplicationWizard audience="admin" detailBase="/main/applications" />} />
                <Route path="/main/applications/:id" element={<AdminWorkspace />} />
                <Route path="/main/bank-transfers" element={<BankTransfersPage />} />
                <Route path="/main/users" element={<UsersPage />} />
                <Route path="/main/users/:id" element={<UserDetailPage />} />
                <Route path="/main/companies" element={<CompaniesPage />} />
                <Route path="/main/vehicles" element={<ProductsPage />} />
                <Route path="/main/vehicles/add" element={<ProductEditPage />} />
                <Route path="/main/vehicles/:id" element={<ProductEditPage />} />
                <Route path="/main/products" element={<Navigate to="/main/vehicles" replace />} />
                <Route path="/main/offers" element={<OffersPage />} />
                <Route path="/main/offers/new" element={<OfferEditPage />} />
                <Route path="/main/offers/:id" element={<OfferEditPage />} />
                <Route path="/main/promotions" element={<PromotionsPage />} />
                <Route path="/main/promotions/new" element={<PromotionEditPage />} />
                <Route path="/main/promotions/:id" element={<PromotionEditPage />} />
                <Route path="/main/insurance-rates" element={<InsuranceRatesPage />} />
                <Route path="/main/insurance-rates/new" element={<InsuranceRateEditPage />} />
                <Route path="/main/insurance-rates/:id" element={<InsuranceRateEditPage />} />
                <Route path="/main/packages" element={<PackagesPage />} />
                <Route path="/main/packages/new" element={<PackageEditPage />} />
                <Route path="/main/packages/:id" element={<PackageEditPage />} />
                <Route path="/main/ledgers" element={<LedgersPage />} />
                <Route path="/main/settings/settlement-discounts" element={<SettlementSettingsPage />} />
                {import.meta.env.DEV && (
                  <Route path="/main/dev-tools/clear-storage" element={<ClearStoragePage />} />
                )}
                <Route path="*" element={<Navigate to="/main/dashboard" replace />} />
              </Routes>
              </Suspense>
            </BloxShell>
            </PortalBasePathProvider>
          </AuthGuard>
        }
      />
    </Routes>
    </OpsAppFrame>
  );
}

mountPortalApp({ sentryApp: 'admin', authBootstrap: true, root: <App /> });
