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

  const nav = useMemo<BloxNavItem[]>(

    () => [

      { to: '/', label: t('ops.credit.nav.dashboard'), icon: 'home' },

      { to: '/queue', label: t('ops.credit.nav.queue'), icon: 'queue' },

      { to: '/zoho-failures', label: t('ops.credit.nav.zohoFailures'), icon: 'logs' },

    ],

    [t],

  );



  return (

    <OpsAppFrame>

    <Routes>

      <Route path="/auth/login" element={<LoginPage portalKey="credit" homePath="/" />} />

      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="credit" homePath="/" />} />

      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="credit" homePath="/" />} />

      <Route

        path="/*"

        element={

          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">

            <BloxShell title="Credit" nav={nav}>

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

