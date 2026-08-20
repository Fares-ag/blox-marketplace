import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AuthGuard,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TwoFactorLoginPage,
  MfaSetupPage,
  BloxShell,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  type ScheduleListResponse,
  OpsPageHeader,
  OpsStatusPill,
  OpsDataTable,
  OpsStatCard,
  OpsEmptyState,
  type BloxNavItem,
  scheduleOpsPillVariant,
  applicationOpsPillVariant,
  useOpsLabels,
  mountPortalApp,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

type ScheduleRow = {
  id: string;
  application_id: string;
  application_status: string;
  customer_name: string | null;
  customer_email: string;
  vehicle: string;
  company_name: string;
  sequence: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  effective_status: string;
  payment_reference: string | null;
};

function SchedulesPage() {
  const { t, scheduleStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [payTarget, setPayTarget] = useState<ScheduleRow | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const statusQuery = statusFilter ? `&status=${statusFilter}` : '';
  const { data, error, isLoading } = useQuery({
    queryKey: ['schedules', statusFilter, page],
    queryFn: () =>
      apiFetch<ScheduleListResponse<ScheduleRow>>(
        `/api/ops/payment-schedules?${buildPaginationQuery(page)}${statusQuery}`,
      ),
  });

  const pay = useMutation({
    mutationFn: (payload: { id: string; method: string; reference: string; amount: number }) =>
      apiFetch(`/api/ops/payment-schedules/${payload.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          method: payload.method,
          reference: payload.reference || undefined,
          amount: payload.amount,
        }),
      }),
    onSuccess: () => {
      setPayTarget(null);
      setReference('');
      setPayAmount(0);
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  const sweep = useMutation({
    mutationFn: () =>
      apiFetch<{ marked_overdue: number }>('/api/ops/payment-schedules/mark-overdue', {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
    onError: (e) => setActionError((e as Error).message),
  });

  const items = data?.items ?? [];
  const summary = data?.summary;
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  return (
    <div className="blox-page">
      <OpsPageHeader
        title={t('ops.finance.schedulesTitle')}
        subtitle={t('ops.finance.schedulesSubtitle')}
        actions={
          <button
            type="button"
            className="blox-btn blox-btn--secondary"
            disabled={sweep.isPending}
            onClick={() => sweep.mutate()}
            title={t('ops.finance.schedulesSubtitle')}
          >
            {sweep.isPending ? t('ops.finance.sweeping') : t('ops.finance.runOverdueSweep')}
          </button>
        }
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
      <div className="blox-stat-grid">
        <OpsStatCard label={t('ops.finance.pending')} value={String(summary?.pending ?? '—')} />
        <OpsStatCard label={t('ops.scheduleStatus.overdue')} value={String(summary?.overdue ?? '—')} />
        <OpsStatCard label={t('ops.finance.paid')} value={String(summary?.paid ?? '—')} />
      </div>
      <div className="blox-filter-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('ops.col.status')}>
          <option value="">{t('ops.finance.allStatuses')}</option>
          <option value="pending">{t('ops.scheduleStatus.pending')}</option>
          <option value="overdue">{t('ops.scheduleStatus.overdue')}</option>
          <option value="paid">{t('ops.scheduleStatus.paid')}</option>
          <option value="waived">{t('ops.scheduleStatus.waived')}</option>
        </select>
      </div>
      <OpsDataTable
        columns={[
          t('ops.col.customer'),
          t('ops.col.vehicle'),
          t('ops.col.seq'),
          t('ops.col.due'),
          t('ops.col.amount'),
          t('ops.col.remaining'),
          t('ops.col.status'),
          '',
        ]}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={
          <OpsEmptyState
            title={isLoading ? t('ops.common.loading') : t('ops.finance.noSchedules')}
            body={isLoading ? '' : t('ops.finance.noSchedulesBody')}
          />
        }
        rows={items.map((r) => [
          <span key="c" title={r.customer_email}>{r.customer_name ?? r.customer_email}</span>,
          r.vehicle,
          `${r.sequence}`,
          r.due_date,
          <span key="a" className="blox-money">QAR {r.amount.toLocaleString()}</span>,
          <span key="r" className="blox-money">QAR {r.remaining_amount.toLocaleString()}</span>,
          <OpsStatusPill key="s" label={scheduleStatus(r.effective_status)} variant={scheduleOpsPillVariant(r.effective_status)} />,
          r.effective_status === 'pending' || r.effective_status === 'overdue' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              onClick={() => {
                setActionError(null);
                setPayTarget(r);
                setPayAmount(r.remaining_amount);
                setReference('');
                setMethod('bank_transfer');
              }}
            >
              {t('ops.finance.recordPayment')}
            </button>
          ) : (
            <span key="b" style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.payment_reference ?? ''}</span>
          ),
        ])}
      />
      {payTarget && (
        <div className="blox-panel" style={{ marginTop: 16, padding: 16, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>
            Record payment — installment {payTarget.sequence} · QAR{' '}
            {payTarget.remaining_amount.toLocaleString()}
          </h3>
          <p style={{ fontSize: '0.8125rem', margin: '4px 0 12px' }}>
            {payTarget.customer_name ?? payTarget.customer_email} · {payTarget.vehicle}
          </p>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
            Payment amount (QAR)
            <input
              type="number"
              min={0.01}
              max={payTarget.remaining_amount}
              step={0.01}
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
            Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cash">Cash at dealer</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 14 }}>
            Settlement reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank ref / receipt number"
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={pay.isPending || payAmount <= 0 || payAmount > payTarget.remaining_amount}
              onClick={() => {
                const customer = payTarget.customer_name ?? payTarget.customer_email;
                const methodLabel = method.replace(/_/g, ' ');
                if (
                  !window.confirm(
                    `Record QAR ${payAmount.toLocaleString()} payment (${methodLabel}) for ${customer} · installment ${payTarget.sequence} on ${payTarget.vehicle}?`,
                  )
                ) {
                  return;
                }
                pay.mutate({ id: payTarget.id, method, reference, amount: payAmount });
              }}
            >
              {pay.isPending ? 'Recording…' : 'Confirm payment'}
            </button>
            <button type="button" className="blox-btn blox-btn--ghost" onClick={() => setPayTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationsPage() {
  const { t, applicationStatus } = useOpsLabels();
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const { data, error } = useQuery({
    queryKey: ['fin-apps', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          status: string;
          customer: { name: string; email: string };
          product: { make: string; model: string; modelYear: number };
          company: { name: string };
        }>;
      }>(`/api/ops/applications?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);

  const transition = useMutation({
    mutationFn: (payload: { id: string; toStatus: string; reason?: string }) =>
      apiFetch(`/api/ops/applications/${payload.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus: payload.toStatus, reason: payload.reason }),
      }),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['fin-apps'] });
    },
    onError: (e) => setActionError((e as Error).message),
  });

  return (
    <div className="blox-page">
      <OpsPageHeader
        title={t('ops.finance.nav.applications')}
        subtitle={t('ops.finance.schedulesSubtitle')}
      />
      {error && <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p>}
      {actionError && <p style={{ color: 'var(--blox-danger)' }}>{actionError}</p>}
      <OpsDataTable
        columns={[
          t('ops.col.customer'),
          t('ops.col.vehicle'),
          t('ops.col.dealer'),
          t('ops.col.status'),
          '',
        ]}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title={t('ops.common.queueClear')} body={t('ops.common.noResults')} />}
        rows={items.map((a) => [
          a.customer.name,
          `${a.product.make} ${a.product.model}`,
          a.company.name,
          <OpsStatusPill key="s" label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />,
          a.status === 'down_payment_required' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={transition.isPending}
              onClick={() => {
                const label = `${a.customer.name} · ${a.product.make} ${a.product.model}`;
                if (!window.confirm(`Mark down payment received for ${label}?`)) return;
                transition.mutate({ id: a.id, toStatus: 'down_payment_submitted' });
              }}
            >
              Down payment received
            </button>
          ) : a.status === 'down_payment_submitted' ? (
            <button
              key="b"
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={transition.isPending}
              onClick={() => {
                const label = `${a.customer.name} · ${a.product.make} ${a.product.model}`;
                if (
                  !window.confirm(`Confirm down payment and queue activation for ${label}?`)
                ) {
                  return;
                }
                transition.mutate({ id: a.id, toStatus: 'pending_finance_activation' });
              }}
            >
              Confirm &amp; queue activation
            </button>
          ) : null,
        ])}
      />
    </div>
  );
}

function App() {
  const { t } = useOpsLabels();
  const navItems = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.finance.nav.schedules'), icon: 'finance' },
      { to: '/applications', label: t('ops.finance.nav.applications'), icon: 'apps' },
    ],
    [t],
  );

  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Finance" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/auth/two-factor"
        element={<TwoFactorLoginPage portalLabel="Blox Finance" homePath="/" />}
      />
      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalLabel="Blox Finance" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="finance_officer" reasonParam="not_finance">
            <BloxShell title="Finance" nav={navItems}>
              <Routes>
                <Route path="/" element={<SchedulesPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BloxShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}

mountPortalApp({ sentryApp: 'finance', authBootstrap: true, root: <App /> });
