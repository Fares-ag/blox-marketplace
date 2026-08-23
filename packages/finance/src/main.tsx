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
  PendingBankTransfers,
  ScheduleLedger,
  type BloxNavItem,
  useOpsLabels,
  mountPortalApp,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { DashboardPage } from './pages/DashboardPage';

function ApplicationsPage() {
  return <ApplicationsList audience="finance" basePath="/applications" />;
}

function FinanceWorkspace() {
  const { id } = useParams();
  if (!id) return <Navigate to="/applications" replace />;
  return <ApplicationWorkspace id={id} audience="finance" backTo="/applications" />;
}

function App() {
  const { t } = useOpsLabels();
  const navItems = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.finance.nav.dashboard'), icon: 'home' },
      { to: '/schedules', label: t('ops.finance.nav.schedules'), icon: 'finance' },
      { to: '/applications', label: t('ops.finance.nav.applications'), icon: 'apps' },
      { to: '/bank-transfers', label: t('ops.finance.nav.bankTransfers'), icon: 'ledgers' },
    ],
    [t],
  );

  return (
    <OpsAppFrame>
      <Routes>
        <Route path="/auth/login" element={<LoginPage portalKey="finance" homePath="/" />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/auth/two-factor"
          element={<TwoFactorLoginPage portalKey="finance" homePath="/" />}
        />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="finance" homePath="/" />} />
        <Route
          path="/*"
          element={
            <AuthGuard allowedRole="finance_officer" reasonParam="not_finance">
              <BloxShell title="Finance" nav={navItems}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/schedules" element={<ScheduleLedger />} />
                  <Route path="/applications" element={<ApplicationsPage />} />
                  <Route path="/applications/:id" element={<FinanceWorkspace />} />
                  <Route path="/bank-transfers" element={<PendingBankTransfers />} />
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

mountPortalApp({ sentryApp: 'finance', authBootstrap: true, root: <App /> });
