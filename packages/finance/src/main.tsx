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
  ApplicationWorkspace,
  FinanceQueue,
  type BloxNavItem,
  useOpsLabels,
  mountPortalApp,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { DashboardPage } from './pages/DashboardPage';
import { FinanceBookPage } from './pages/FinanceBookPage';
import { FinancePaymentsPage } from './pages/FinancePaymentsPage';
import { FinanceSettlementsPage } from './pages/FinanceSettlementsPage';
import { FinanceCreditsPage } from './pages/FinanceCreditsPage';
import { FinanceExportsPage } from './pages/FinanceExportsPage';

function ApplicationsPage() {
  return <ApplicationsList audience="finance" />;
}

function FinanceWorkspace() {
  const { id } = useParams();
  if (!id) return <Navigate to="/queue" replace />;
  return <ApplicationWorkspace id={id} audience="finance" backTo="/queue" />;
}

/**
 * Finance portal — nav mirrors blox-vercel FINANCE_PORTAL.md:
 * Queue (Activation view / Review) · Active Book · Payments · Settlements · Credits · Exports.
 * Dashboard and Applications are marketplace extras kept for continuity.
 */
function App() {
  const { t } = useOpsLabels();
  const navItems = useMemo<BloxNavItem[]>(
    () => [
      { to: '/dashboard', label: t('ops.finance.nav.dashboard'), icon: 'home' },
      { to: '/queue', label: t('ops.finance.nav.queue'), icon: 'queue' },
      { to: '/book', label: t('ops.finance.nav.book'), icon: 'ledgers' },
      { to: '/payments', label: t('ops.finance.nav.payments'), icon: 'finance' },
      { to: '/settlements', label: t('ops.finance.nav.settlements'), icon: 'offers' },
      { to: '/credits', label: t('ops.finance.nav.credits'), icon: 'packages' },
      { to: '/exports', label: t('ops.finance.nav.exports'), icon: 'logs' },
      { to: '/applications', label: t('ops.finance.nav.applications'), icon: 'apps' },
    ],
    [t],
  );

  return (
    <OpsAppFrame>
      <Routes>
        <Route path="/auth/login" element={<LoginPage portalKey="finance" homePath="/queue" />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="finance" homePath="/queue" />} />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="finance" homePath="/queue" />} />
        <Route
          path="/*"
          element={
            <AuthGuard allowedRole="finance_officer" reasonParam="not_finance">
              <BloxShell title="Finance" nav={navItems} homePaths={['/queue']}>
                <Routes>
                  <Route path="/" element={<Navigate to="/queue" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/queue" element={<FinanceQueue />} />
                  <Route path="/book" element={<FinanceBookPage />} />
                  <Route path="/payments" element={<FinancePaymentsPage />} />
                  <Route path="/settlements" element={<FinanceSettlementsPage />} />
                  <Route path="/credits" element={<FinanceCreditsPage />} />
                  <Route path="/exports" element={<FinanceExportsPage />} />
                  <Route path="/applications" element={<ApplicationsPage />} />
                  <Route path="/applications/:id" element={<FinanceWorkspace />} />
                  {/* vercel-style deep links and legacy marketplace routes */}
                  <Route path="/applications/view/:id" element={<FinanceWorkspace />} />
                  <Route path="/schedules" element={<Navigate to="/payments?tab=schedules" replace />} />
                  <Route path="/bank-transfers" element={<Navigate to="/payments?tab=bank" replace />} />
                  <Route path="*" element={<Navigate to="/queue" replace />} />
                </Routes>
              </BloxShell>
            </AuthGuard>
          }
        />
      </Routes>
    </OpsAppFrame>
  );
}

mountPortalApp({ sentryApp: 'finance', authBootstrap: true, root: <App /> });
