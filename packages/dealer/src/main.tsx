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
  useNavCounts,
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
  const counts = useNavCounts<{ open_applications: number; quotes_active: number }>('/api/ops/metrics/dealer');
  const nav = useMemo<BloxNavItem[]>(() => {
    const work = t('ops.shell.groupWork');
    const company = t('ops.shell.groupCompany');
    return [
      { to: '/', label: t('ops.dealer.nav.dashboard'), icon: 'home', group: work },
      { to: '/applications', label: t('ops.dealer.nav.applications'), icon: 'apps', group: work, count: counts?.open_applications },
      { to: '/applications/new', label: t('ops.dealer.nav.newApplication'), icon: 'apps', group: work },
      { to: '/quotes', label: t('ops.dealer.nav.quotes'), icon: 'quotes', group: work, count: counts?.quotes_active },
      { to: '/inventory', label: t('ops.dealer.nav.inventory'), icon: 'inventory', group: company },
      { to: '/company', label: t('ops.dealer.nav.company'), icon: 'company', group: company },
    ];
  }, [t, counts]);

  return (
    <OpsAppFrame>
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalKey="dealer" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage portalKey="dealer" />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage portalKey="dealer" />} />
      <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="dealer" homePath="/" />} />
      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="dealer" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="dealer_agent" reasonParam="not_dealer">
            <BloxShell title="Dealer" nav={nav} searchPath="/applications">
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
