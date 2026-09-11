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
  LpoInboxPage,
  type BloxNavItem,
  useAuthStore,
  useOpsLabels,
  mountPortalApp,
  useNavCounts,
  normalizePartnerSummary,
  partnerStatusesFor,
  partnerSummaryCount,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { DashboardPage } from './pages/DashboardPage';
import { FinanceBookPage } from './pages/FinanceBookPage';
import { FinancePaymentsPage } from './pages/FinancePaymentsPage';
import { FinanceSettlementsPage } from './pages/FinanceSettlementsPage';
import { FinanceCreditsPage } from './pages/FinanceCreditsPage';
import { FinanceExportsPage } from './pages/FinanceExportsPage';
import { PartnerDetailPage, PartnerListPage } from './pages/PartnerPages';

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
 *
 * The same portal hosts the finance-partner read-only view: a `partner_viewer`
 * signs in here, sees only `/partner` (list + detail) and nothing else.
 */
function App() {
  const { t } = useOpsLabels();
  const role = useAuthStore((s) => s.user?.role ?? null);
  const partner = role === 'partner_viewer';
  const counts = useNavCounts<Record<string, unknown>>(partner ? '/api/partner/summary' : '/api/ops/metrics/finance');
  const partnerReviewCount = useMemo(() => {
    if (!partner || !counts) return undefined;
    const summary = normalizePartnerSummary(counts);
    const inReview = partnerSummaryCount(summary, partnerStatusesFor('review'));
    return inReview > 0 ? inReview : undefined;
  }, [partner, counts]);

  const navItems = useMemo<BloxNavItem[]>(() => {
    if (partner) {
      return [{ to: '/partner', label: t('dealerOps.partnerView.navApplications'), icon: 'apps', count: partnerReviewCount }];
    }
    const work = t('ops.shell.groupWork');
    const reference = t('ops.shell.groupReference');
    const finance = counts as { pending_bank_transfers?: number; schedules_overdue?: number } | undefined;
    return [
      { to: '/dashboard', label: t('ops.finance.nav.dashboard'), icon: 'home', group: work },
      { to: '/queue', label: t('ops.finance.nav.queue'), icon: 'queue', group: work },
      { to: '/book', label: t('ops.finance.nav.book'), icon: 'ledgers', group: work },
      { to: '/payments', label: t('ops.finance.nav.payments'), icon: 'finance', group: work, count: finance?.pending_bank_transfers },
      { to: '/settlements', label: t('ops.finance.nav.settlements'), icon: 'offers', group: work },
      { to: '/lpo', label: t('ops.finance.nav.lpo'), icon: 'offers', group: work },
      { to: '/credits', label: t('ops.finance.nav.credits'), icon: 'packages', group: reference },
      { to: '/exports', label: t('ops.finance.nav.exports'), icon: 'logs', group: reference },
      { to: '/applications', label: t('ops.finance.nav.applications'), icon: 'apps', group: reference },
    ];
  }, [t, counts, partner, partnerReviewCount]);

  return (
    <OpsAppFrame>
      <Routes>
        <Route path="/auth/login" element={<LoginPage portalKey="finance" homePath="/queue" />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage portalKey="finance" />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage portalKey="finance" />} />
        <Route path="/auth/two-factor" element={<TwoFactorLoginPage portalKey="finance" homePath="/queue" />} />
        <Route path="/auth/mfa-setup" element={<MfaSetupPage portalKey="finance" homePath="/queue" />} />
        <Route
          path="/*"
          element={
            <AuthGuard allowedRole={['finance_officer', 'partner_viewer']} reasonParam="not_finance">
              <BloxShell
                title={partner ? t('dealerOps.partnerView.title') : 'Finance'}
                nav={navItems}
                homePaths={[partner ? '/partner' : '/queue']}
                searchPath={partner ? '/partner' : '/applications'}
              >
                {partner ? (
                  <Routes>
                    <Route path="/partner" element={<PartnerListPage />} />
                    <Route path="/partner/:id" element={<PartnerDetailPage />} />
                    {/* Partner viewers see nothing else in this portal (login lands on /queue). */}
                    <Route path="*" element={<Navigate to="/partner" replace />} />
                  </Routes>
                ) : (
                  <Routes>
                    <Route path="/" element={<Navigate to="/queue" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/queue" element={<FinanceQueue />} />
                    <Route path="/book" element={<FinanceBookPage />} />
                    <Route path="/payments" element={<FinancePaymentsPage />} />
                    <Route path="/settlements" element={<FinanceSettlementsPage />} />
                    <Route path="/lpo" element={<LpoInboxPage detailBase="/applications" titleKey="ops.finance.nav.lpo" />} />
                    <Route path="/credits" element={<FinanceCreditsPage />} />
                    <Route path="/exports" element={<FinanceExportsPage />} />
                    <Route path="/applications" element={<ApplicationsPage />} />
                    <Route path="/applications/:id" element={<FinanceWorkspace />} />
                    {/* vercel-style deep links and legacy marketplace routes */}
                    <Route path="/applications/view/:id" element={<FinanceWorkspace />} />
                    <Route path="/schedules" element={<Navigate to="/payments?tab=schedules" replace />} />
                    <Route path="/bank-transfers" element={<Navigate to="/payments?tab=bank" replace />} />
                    <Route path="/partner/*" element={<Navigate to="/queue" replace />} />
                    <Route path="*" element={<Navigate to="/queue" replace />} />
                  </Routes>
                )}
              </BloxShell>
            </AuthGuard>
          }
        />
      </Routes>
    </OpsAppFrame>
  );
}

mountPortalApp({ sentryApp: 'finance', authBootstrap: true, root: <App /> });
