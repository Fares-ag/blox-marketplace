import { useMemo } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TwoFactorLoginPage,
  MfaSetupPage,
  BloxShell,
  OpsAppFrame,
  ApplicationsList,
  AddApplicationWizard,
  ApplicationWorkspace,
  mountPortalApp,
  type BloxNavItem,
  useOpsLabels,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { CompanyPage, DashboardPage, InventoryEditor, InventoryList, QuotesPage } from './pages';

function DealerWorkspace() {
  const { id } = useParams();
  if (!id) return <Navigate to="/applications" replace />;
  return <ApplicationWorkspace id={id} audience="dealer" backTo="/applications" />;
}

function App() {
  const { t } = useOpsLabels();
  const nav = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.dealer.nav.dashboard'), icon: 'home' },
      { to: '/applications', label: t('ops.dealer.nav.applications'), icon: 'apps' },
      { to: '/applications/new', label: t('ops.dealer.nav.newApplication'), icon: 'apps' },
      { to: '/inventory', label: t('ops.dealer.nav.inventory'), icon: 'inventory' },
      { to: '/quotes', label: t('ops.dealer.nav.quotes'), icon: 'quotes' },
      { to: '/company', label: t('ops.dealer.nav.company'), icon: 'company' },
    ],
    [t],
  );

  return (
    <OpsAppFrame>
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalKey="dealer" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="dealer" homePath="/" />} />
      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="dealer" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="dealer_agent" reasonParam="not_dealer">
            <BloxShell title="Dealer" nav={nav}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route
                  path="/applications"
                  element={<ApplicationsList audience="dealer" basePath="/applications" createPath="/applications/new" />}
                />
                <Route path="/applications/new" element={<AddApplicationWizard audience="dealer" detailBase="/applications" />} />
                <Route path="/applications/:id" element={<DealerWorkspace />} />
                <Route path="/inventory" element={<InventoryList />} />
                <Route path="/inventory/new" element={<InventoryEditor />} />
                <Route path="/inventory/:id" element={<InventoryEditor />} />
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/company" element={<CompanyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BloxShell>
          </AuthGuard>
        }
      />
    </Routes>
    </OpsAppFrame>
  );
}

mountPortalApp({ sentryApp: 'dealer', authBootstrap: true, root: <App /> });
