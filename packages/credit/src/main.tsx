import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  getApiBase,
  applicationOpsPillVariant,
  useOpsLabels,
  mountPortalApp,
  type ApplicationDetail,
  type BloxNavItem,
  type PaginatedResponse,
} from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';

type AppDetail = ApplicationDetail;

function snapshotText(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function snapshotMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `QAR ${amount.toLocaleString()}`;
}

function snapshotPercent(value: unknown): string {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return '—';
  return `${rate}%`;
}

function snapshotTenure(pricing: Record<string, unknown>): string {
  const months = Number(pricing.tenor ?? pricing.tenure);
  if (!Number.isFinite(months) || months <= 0) return '—';
  return `${months} months`;
}

function ApplicantPlanSection({ data }: { data: AppDetail }) {
  const { t } = useOpsLabels();
  const customer = data.customer_snapshot ?? {};
  const pricing = data.pricing_snapshot ?? {};
  const rowStyle = { display: 'grid', gridTemplateColumns: '9rem 1fr', gap: 8, fontSize: '0.875rem' } as const;
  const labelStyle = { color: 'var(--blox-muted, #5b6b73)', fontWeight: 600 } as const;

  return (
    <section className="blox-panel">
      <h2 className="blox-panel__title">{t('ops.credit.applicantPlan')}</h2>      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px 32px',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.75 }}>
            {t('ops.credit.applicant')}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.fullName')}</span>              <span>{snapshotText(customer.full_name ?? data.customer?.name)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.phone')}</span>
              <span>{snapshotText(customer.phone ?? data.customer?.phone)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.qid')}</span>
              <span>{snapshotText(customer.qid)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.employment')}</span>
              <span>{snapshotText(customer.employment)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.statedIncome')}</span>              <span>{snapshotMoney(customer.income)}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.75 }}>
            {t('ops.credit.planTerms')}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.vehiclePrice')}</span>
              <span>{snapshotMoney(pricing.list_price)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.offer')}</span>
              <span>{snapshotText(data.offer?.name)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.annualRate')}</span>
              <span>{snapshotPercent(pricing.rate ?? data.offer?.annual_rent_rate)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.tenure')}</span>
              <span>{snapshotTenure(pricing)}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.downPayment')}</span>              <span>
                {snapshotMoney(pricing.down_payment)}
                {Number.isFinite(Number(pricing.down_payment_pct))
                  ? ` (${Number(pricing.down_payment_pct)}%)`
                  : ''}
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('ops.credit.monthlyInstallment')}</span>              <span className="blox-money">{snapshotMoney(pricing.monthly)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Queue() {
  const { t, applicationStatus, pagination: pagLabel } = useOpsLabels();
  const [page, setPage] = useState(0);  const { data, error } = useQuery({
    queryKey: ['ops-apps', page],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          status: string;
          customer: { name: string; email: string };
          product: { make: string; model: string };
          company: { name: string };
        }>;
      }>(`/api/ops/applications?${buildPaginationQuery(page)}`),
  });
  const items = data?.items ?? [];
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.credit.queueTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.credit.queueSubtitle')}</p>
        </div>
      </header>
      {error && <p style={{ color: '#b42318' }}>{(error as Error).message}</p>}
      {!items.length ? (
        <p className="blox-empty">{t('ops.common.queueClear')}</p>
      ) : (
        <>
          <div className="blox-table-wrap">
            <table className="blox-table">
              <thead>
                <tr>
                  <th>{t('ops.col.vehicle')}</th>
                  <th>{t('ops.col.customer')}</th>
                  <th>{t('ops.col.dealer')}</th>
                  <th>{t('ops.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/applications/${a.id}`}>
                        {a.product.make} {a.product.model}
                      </Link>
                    </td>
                    <td>{a.customer.name}</td>
                    <td>{a.company.name}</td>
                    <td>
                      <span className={`blox-pill blox-pill--${applicationOpsPillVariant(a.status)}`}>{applicationStatus(a.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="blox-pagination" style={{ marginTop: 12 }}>
            <span>{pagLabel(from, to, total)}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={from <= 1}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('ops.pagination.previous')}
              </button>
              <button
                type="button"
                className="blox-btn blox-btn--ghost"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('ops.pagination.next')}
              </button>
            </div>
          </div>
        </>
      )}    </div>
  );
}

function Detail() {
  const { t, applicationStatus } = useOpsLabels();
  const { id } = useParams();  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<AppDetail>(`/api/applications/${id}`),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['app', id] });
    void qc.invalidateQueries({ queryKey: ['ops-apps'] });
  };

  const transition = useMutation({
    mutationFn: (toStatus: string) =>
      apiFetch(`/api/ops/applications/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, reason: reason.trim() || undefined }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const approveContract = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}/approve-contract`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const activate = useMutation({
    mutationFn: (direct?: boolean) =>
      apiFetch(`/api/ops/applications/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ direct: !!direct }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const status = data?.status ?? '';
  const busy = transition.isPending || approveContract.isPending || activate.isPending;
  const detailLabel = data
    ? `${data.product?.make} ${data.product?.model} · ${data.customer?.name}`
    : '';

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.credit.reviewTitle')}</h1>
          <p className="blox-page-header__subtitle">
            {data?.product?.make} {data?.product?.model} · {data?.customer?.name}
          </p>
        </div>
        <div className="blox-page-header__actions">
          <Link className="blox-btn blox-btn--ghost" to="/">
            {t('ops.common.backToQueue')}
          </Link>
        </div>
      </header>

      {data && (
        <>
          <section className="blox-panel">
            <h2 className="blox-panel__title">{t('ops.credit.summary')}</h2>
            <p>
              {t('ops.credit.summaryStatus')}:{' '}
              <span className={`blox-pill blox-pill--${applicationOpsPillVariant(status)}`}>{applicationStatus(status)}</span>
            </p>
            <p>{t('ops.credit.summaryDealer')}: {data.company?.name}</p>
            <p>{t('ops.credit.summaryCustomerEmail')}: {data.customer?.email}</p>
          </section>
          <ApplicantPlanSection data={data} />

          {(data.documents?.length ?? 0) > 0 && (
            <section className="blox-panel">
              <h2 className="blox-panel__title">{t('ops.credit.kycDocuments')}</h2>
              <ul>
                {data.documents!.map((doc) => (
                  <li key={doc.id}>
                    {doc.category}{' '}
                    <a
                      href={`${getApiBase()}/applications/${id}/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('ops.common.view')}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="blox-panel" style={{ maxWidth: 560 }}>
            <h2 className="blox-panel__title">{t('ops.credit.actions')}</h2>
            {actionError && <p style={{ color: '#b42318' }}>{actionError}</p>}
            <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
              {t('ops.credit.reasonForReject')}
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              {status === 'under_review' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--primary"
                  disabled={busy}
                  onClick={() => approveContract.mutate()}
                >
                  {approveContract.isPending ? t('ops.common.sending') : t('ops.credit.approveSendContract')}
                </button>
              )}
              {status === 'contracts_submitted' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--secondary"
                  disabled={busy}
                  onClick={() => transition.mutate('contract_under_review')}
                >
                  {t('ops.credit.startContractReview')}
                </button>
              )}
              {status === 'contract_under_review' && (
                <>
                  <button
                    type="button"
                    className="blox-btn blox-btn--secondary"
                    disabled={busy}
                    onClick={() => transition.mutate('pending_finance_activation')}
                  >
                    {t('ops.credit.approveContract')}
                  </button>
                  <button
                    type="button"
                    className="blox-btn blox-btn--ghost"
                    disabled={busy}
                    onClick={() => transition.mutate('down_payment_required')}
                  >
                    {t('ops.credit.requireDownPayment')}
                  </button>
                </>
              )}
              {status === 'pending_finance_activation' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--primary"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(t('ops.credit.activateConfirm', { label: detailLabel }))) return;
                    activate.mutate(false);
                  }}
                >
                  {activate.isPending ? t('ops.common.activating') : t('ops.credit.activateFinancing')}
                </button>
              )}
              {status === 'under_review' && (
                <button
                  type="button"
                  className="blox-btn blox-btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(t('ops.credit.directActivateConfirm', { label: detailLabel }))) return;
                    activate.mutate(true);
                  }}
                >
                  {activate.isPending ? t('ops.common.activating') : t('ops.credit.directActivate')}
                </button>
              )}
              {['under_review', 'resubmission_required', 'contract_signing_required'].includes(status) && (
                <>
                  <button
                    type="button"
                    className="blox-btn blox-btn--secondary"
                    disabled={busy}
                    onClick={() => transition.mutate('resubmission_required')}
                  >
                    {t('ops.credit.requestResubmission')}
                  </button>
                  <button
                    type="button"
                    className="blox-btn blox-btn--danger"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(t('ops.credit.rejectConfirm', { label: detailLabel }))) return;
                      transition.mutate('rejected');
                    }}
                  >
                    {t('ops.common.reject')}
                  </button>
                </>
              )}            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ZohoFailuresPage() {
  const { t, applicationStatus } = useOpsLabels();
  const { data, error } = useQuery({
    queryKey: ['zoho-failures'],
    queryFn: () =>
      apiFetch<
        PaginatedResponse<{
          application_id: string;
          reason: string;
          status: string;
          customer_email: string;
          error: string | null;
        }>
      >('/api/ops/zoho/failures'),
  });
  const items = data?.items ?? [];

  return (
    <div className="blox-page">
      <header className="blox-page-header">
        <div>
          <h1>{t('ops.credit.zohoTitle')}</h1>
          <p className="blox-page-header__subtitle">{t('ops.credit.zohoSubtitle')}</p>
        </div>
      </header>
      {error && <p style={{ color: '#b42318' }}>{(error as Error).message}</p>}
      {!items.length ? (
        <p className="blox-empty">{t('ops.credit.zohoEmpty')}</p>
      ) : (
        <div className="blox-table-wrap">
          <table className="blox-table">
            <thead>
              <tr>
                <th>{t('ops.col.application')}</th>
                <th>{t('ops.col.customer')}</th>
                <th>{t('ops.col.status')}</th>
                <th>{t('ops.col.error')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.application_id}>
                  <td>
                    <Link to={`/applications/${row.application_id}`}>{row.application_id.slice(0, 8)}…</Link>
                  </td>
                  <td>{row.customer_email}</td>
                  <td>{applicationStatus(row.status)}</td>
                  <td>{row.error ?? row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}    </div>
  );
}

function App() {
  const { t } = useOpsLabels();
  const nav = useMemo<BloxNavItem[]>(
    () => [
      { to: '/', label: t('ops.credit.nav.queue'), icon: 'queue' },
      { to: '/applications', label: t('ops.credit.nav.applications'), icon: 'apps' },
      { to: '/zoho-failures', label: t('ops.credit.nav.zohoFailures'), icon: 'logs' },
    ],
    [t],
  );

  return (    <Routes>
      <Route path="/auth/login" element={<LoginPage portalLabel="Blox Credit" homePath="/" />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/auth/two-factor"
        element={<TwoFactorLoginPage portalLabel="Blox Credit" homePath="/" />}
      />
      <Route path="/auth/mfa-setup" element={<MfaSetupPage portalLabel="Blox Credit" homePath="/" />} />
      <Route
        path="/*"
        element={
          <AuthGuard allowedRole="credit_officer" reasonParam="not_credit">
            <BloxShell title="Credit" nav={nav}>
              <Routes>
                <Route path="/" element={<Queue />} />
                <Route path="/applications" element={<Queue />} />
                <Route path="/applications/:id" element={<Detail />} />
                <Route path="/zoho-failures" element={<ZohoFailuresPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BloxShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}

mountPortalApp({ sentryApp: 'credit', authBootstrap: true, root: <App /> });
