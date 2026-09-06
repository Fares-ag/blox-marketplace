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

  CreditQueue,

  ApplicationWorkspace,

  mountPortalApp,

  type BloxNavItem,

  useOpsLabels,

  useNavCounts,
} from '@drivemarket/shared';

import '@drivemarket/shared/styles/global.scss';

import { ZohoFailuresPage } from './pages/ZohoFailuresPage';

import { DashboardPage } from './pages/DashboardPage';



function CreditWorkspace() {

  const { id } = useParams();

  if (!id) return <Navigate to="/queue" replace />;

  return <ApplicationWorkspace id={id} audience="credit" backTo="/queue" />;

}



function App() {

  const { t } = useOpsLabels();

  const counts = useNavCounts<{ in_review: number; zoho_failures: number }>('/api/ops/metrics/credit');
  const nav = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.credit.nav.dashboard'), icon: 'home' },
      { to: '/queue', label: t('ops.credit.nav.queue'), icon: 'queue', count: counts?.in_review },
      { to: '/zoho-failures', label: t('ops.credit.nav.zohoFailures'), icon: 'logs', count: counts?.zoho_failures },
    ],
    [t, counts],

  );



  return (

    <OpsAppFrame>

    <Routes>

      <Route path="/auth/login" element={<LoginPage portalKey="credit" homePath="/" />} />

      <Route path="/auth/forgot-password" element={<ForgotPasswordPage portalKey="credit" />} />

      <Route path="/auth/reset-password" element={<ResetPasswordPage portalKey="credit" />} />

      <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="credit" homePath="/" />} />

      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="credit" homePath="/" />} />

      <Route

        path="/*"

        element={

          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">

            <BloxShell title="Credit" nav={nav} searchPath="/queue">

              <Routes>

                <Route path="/" element={<DashboardPage />} />

                <Route path="/queue" element={<CreditQueue detailBase="/applications" />} />

                <Route path="/applications" element={<Navigate to="/queue" replace />} />

                <Route path="/applications/:id" element={<CreditWorkspace />} />

                <Route path="/zoho-failures" element={<ZohoFailuresPage />} />

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



mountPortalApp({ sentryApp: 'credit', authBootstrap: true, root: <App /> });

