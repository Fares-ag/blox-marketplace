import { useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TwoFactorLoginPage,
  MfaSetupPage,
  BloxShell,
  OpsAppFrame,
  type BloxNavItem,
  useOpsLabels,
  mountPortalApp,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import {
  ActivityLogsPage,
  CompaniesPage,
  DashboardPage,
  SystemPage,
  UsersPage,
} from './pages';

function App() {
  const { t } = useOpsLabels();
  const nav = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.superAdmin.nav.dashboard'), icon: 'home' },
      { to: '/users', label: t('ops.superAdmin.nav.users'), icon: 'users' },
      { to: '/companies', label: t('ops.superAdmin.nav.companies'), icon: 'company' },
      { to: '/activity-logs', label: t('ops.superAdmin.nav.activityLogs'), icon: 'logs' },
      { to: '/system', label: t('ops.superAdmin.nav.system'), icon: 'system' },
    ],
    [t],
  );

  return (
    <OpsAppFrame>
      <Routes>
        <Route path="/auth/login" element={<LoginPage portalKey="superAdmin" homePath="/" />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/auth/two-factor"
          element={<TwoFactorLoginPage portalKey="superAdmin" homePath="/" />}
        />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="superAdmin" homePath="/" />} />
        <Route
          path="/*"
          element={
            <AuthGuard allowedRole="super_admin" reasonParam="not_super_admin">
              <BloxShell title="Super Admin" nav={nav}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/companies" element={<CompaniesPage />} />
                  <Route path="/activity-logs" element={<ActivityLogsPage />} />
                  <Route path="/system" element={<SystemPage />} />
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

mountPortalApp({ sentryApp: 'ops', authBootstrap: true, root: <App /> });
