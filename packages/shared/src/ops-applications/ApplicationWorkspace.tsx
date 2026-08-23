import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFileUrl } from '../lib/api';
import { applicationOpsPillVariant, scheduleOpsPillVariant } from '../config/status-styles';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { toast } from 'react-toastify';
import {
  ConfirmDialog,
  HorizontalBarChart,
  OpsDetailGrid,
  OpsDetailPage,
  PageSkeleton,
  SegmentedBarChart,
} from '../ops-ui-v2';
import { bloxTokens } from '../config/blox-tokens';
import { calculateOwnershipTimeline } from '../lib/ownership';
import { resolveDisplaySchedule } from '../lib/resolve-display-schedule';
import type { InstallmentPlan } from '../types/installment-plan';
import { InstallmentScheduleTable } from './InstallmentScheduleTable';
import { OpsStatusPill } from '../components/ops-ui';
import type { OpsAgent, OpsAudience, OpsWorkspace } from './types';
import { visibleWorkspaceActions } from './useApplicationActions';
import { CustomerInfoOverview } from './CustomerInfoOverview';
import { customerInfoFromSnapshot, docCategoriesForApplicant } from './customer-info';

const TABS = ['overview', 'transactions', 'schedule', 'logs', 'comments', 'docs'] as const;
const PAY_METHODS = ['bank_transfer', 'card', 'cash', 'cheque'] as const;

type PayTarget = {
  id: string;
  sequence: number;
  amount: number | null;
  remaining_amount: number;
  status: string;
  pending_waive_reason?: string | null;
  pending_waive_requested_by_id?: string | null;
};

export function ApplicationWorkspace({
  id,
  audience,
  backTo,
}: {
  id: string;
  audience: OpsAudience;
  backTo: string;
}) {
  const { t, applicationStatus, scheduleStatus } = useOpsLabels();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editHideInterest, setEditHideInterest] = useState(false);
  const [editAgentId, setEditAgentId] = useState('');
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<string>('bank_transfer');
  const [payReference, setPayReference] = useState('');
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [editCompanyId, setEditCompanyId] = useState('');
  const [payProof, setPayProof] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ['ops-app', id],
    queryFn: () => apiFetch<OpsWorkspace>(`/api/applications/${id}`),
    enabled: !!id,
  });

  const actions = visibleWorkspaceActions(data?.status ?? 'draft', role);

  const agents = useQuery({
    queryKey: ['ws-agents', data?.company?.id],
    queryFn: () => apiFetch<{ items: OpsAgent[] }>(`/api/companies/${data!.company!.id}/agents`),
    enabled: !!actions.edit && !!data?.company?.id,
  });

  useEffect(() => {
    if (!data) return;
    const pricing = data.pricing_snapshot ?? {};
    setEditHideInterest(!!pricing.hide_interest);
    setEditAgentId(data.agent?.id ?? '');
    setEditCompanyId(data.company?.id ?? '');
  }, [data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ops-app', id] });
    void qc.invalidateQueries({ queryKey: ['ops-apps'] });
    void qc.invalidateQueries({ queryKey: ['credit-queue'] });
  };

  const transition = useMutation({
    mutationFn: (toStatus: string) =>
      apiFetch(`/api/ops/applications/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, reason: reason.trim() || undefined }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const approve = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/approve-contract`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const activate = useMutation({
    mutationFn: (direct?: boolean) =>
      apiFetch(`/api/ops/applications/${id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ direct: !!direct }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/submit`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const compliance = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/compliance-check`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const postComment = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ comment }),
      }),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });
  const patchEdit = useMutation({
    mutationFn: (body: { hideInterest?: boolean; agentUserId?: string | null; companyId?: string }) =>
      apiFetch(`/api/ops/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setShowEdit(false);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
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
      setPayReference('');
      setPayAmount(0);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });
  const requestWaive = useMutation({
    mutationFn: (payload: { scheduleId: string; reason: string }) =>
      apiFetch(`/api/ops/payment-schedules/${payload.scheduleId}/waive/request`, {
        method: 'POST',
        body: JSON.stringify({ reason: payload.reason }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const confirmWaive = useMutation({
    mutationFn: (scheduleId: string) =>
      apiFetch(`/api/ops/payment-schedules/${scheduleId}/waive/confirm`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const uploadSignedContract = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiFetch(`/api/ops/applications/${id}/contract/signed`, { method: 'POST', body: fd });
    },
    onSuccess: () => {
      setSignedContractFile(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });
  const uploadDoc = useMutation({
    mutationFn: (payload: { category: string; file: File }) => {
      const fd = new FormData();
      fd.append('category', payload.category);
      fd.append('file', payload.file);
      return apiFetch(`/api/ops/applications/${id}/documents`, { method: 'POST', body: fd });
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const deleteApp = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Application deleted');
      window.location.href = backTo;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const convertDaily = useMutation({
    mutationFn: () => apiFetch(`/api/ops/applications/${id}/convert-daily-to-monthly`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toast.success('Schedule converted');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rebuild = useMutation({
    mutationFn: (body: { tenureMonths?: number; downPaymentPct?: number }) =>
      apiFetch(`/api/ops/applications/${id}/rebuild-schedule`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Installments updated');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const companies = useQuery({
    queryKey: ['ws-companies'],
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>('/api/companies/all?limit=100&offset=0'),
    enabled: !!actions.assignCompany,
  });
  const downPay = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ops/applications/${id}/down-payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number((data?.pricing_snapshot as { down_payment?: number })?.down_payment ?? 0) || 1 }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  if (!data) {
    return (
      <div className="blox-page">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  const label = `${data.product?.make ?? ''} ${data.product?.model ?? ''} · ${data.customer?.name ?? data.customer_email}`;
  const busy =
    transition.isPending ||
    approve.isPending ||
    activate.isPending ||
    submit.isPending ||
    patchEdit.isPending ||
    uploadSignedContract.isPending;
  const snap = data.customer_snapshot ?? {};
  const applicantType = customerInfoFromSnapshot(snap).applicantType;
  const docCategories = docCategoriesForApplicant(applicantType);
  const pricing = data.pricing_snapshot ?? {};
  const installmentPlan = data.installment_plan as InstallmentPlan | null | undefined;
  const vehiclePrice = Number(pricing.list_price ?? pricing.selling_price ?? 0);
  const displaySchedules = resolveDisplaySchedule({
    installmentPlan,
    paymentSchedules: data.payment_schedules,
    vehiclePrice,
    isActiveOrLater: data.status === 'active' || data.status === 'completed',
  });
  const ownershipSchedules =
    (data.payment_schedules ?? []).length > 0
      ? (data.payment_schedules ?? []).map((row) => ({
          sequence: row.sequence,
          dueDate: row.due_date,
          amount: row.amount ?? 0,
          paid_amount: row.paid_amount ?? 0,
          status: row.status,
        }))
      : displaySchedules.map((row, index) => ({
          sequence: row.sequence ?? index + 1,
          dueDate: row.dueDate,
          amount: row.amount,
          paid_amount: 0,
          status: String(row.status),
        }));
  const ownership = calculateOwnershipTimeline(pricing, ownershipSchedules);
  const customerPct = ownership.currentOwnership;
  const bloxPct = Math.max(0, 100 - customerPct);
  const showAssetDistribution = ownership.vehiclePrice > 0;

  function openPayDialog(row: PayTarget) {
    setError(null);
    setPayTarget(row);
    setPayAmount(row.remaining_amount ?? Number(row.amount ?? 0));
    setPayReference('');
    setPayMethod('bank_transfer');
  }

  const visibleTabs = TABS.filter(
    (name) => name !== 'logs' || audience === 'super_admin' || audience === 'admin' || audience === 'credit',
  );

  const headerActions = (
    <div className="blox-inline-actions">
      {actions.deleteApp && (
        <button
          type="button"
          className="blox-btn blox-btn--ghost"
          onClick={() =>
            setConfirm({
              title: 'Delete application',
              message: 'Delete this draft or cancelled application?',
              onConfirm: () => deleteApp.mutate(),
            })
          }
        >
          Delete
        </button>
      )}
      {actions.convertDaily && (
        <button type="button" className="blox-btn blox-btn--secondary" onClick={() => convertDaily.mutate()}>
          Convert daily to monthly
        </button>
      )}
      {actions.editInstallments && (
        <button
          type="button"
          className="blox-btn blox-btn--secondary"
          onClick={() => {
            const tenure = Number(window.prompt('Tenure months', String((pricing as { tenor?: number }).tenor ?? 36)));
            const down = Number(window.prompt('Down payment %', String((pricing as { down_payment_pct?: number }).down_payment_pct ?? 10)));
            if (!tenure || !down) return;
            rebuild.mutate({ tenureMonths: tenure, downPaymentPct: down });
          }}
        >
          Edit installments
        </button>
      )}
    </div>
  );

  return (
    <>
      <OpsDetailPage
        backTo={backTo}
        backLabel={t('ops.common.backToQueue')}
        title={t('ops.workspace.title')}
        idLabel={label}
        status={{ label: applicationStatus(data.status), variant: applicationOpsPillVariant(data.status) }}
        headerActions={headerActions}
        tabs={visibleTabs.map((name) => ({ value: name, label: t(`ops.workspace.tab.${name}`) }))}
        activeTab={tab}
        onTabChange={(v) => setTab(v as (typeof TABS)[number])}
      >
      {error && <p style={{ color: 'var(--blox-danger)' }}>{error}</p>}
      {data.status === 'partner_processing' && (
        <p className="blox-panel" style={{ padding: 12 }}>
          {t('ops.common.sentToPartner', { partner: data.finance_partner_name ?? t('ops.common.partnerFinance') })}
        </p>
      )}

      {actions.edit && (
        <section className="blox-detail-section" style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h2 className="blox-panel__title" style={{ margin: 0 }}>
              {t('ops.workspace.editApplication')}
            </h2>
            <button type="button" className="blox-btn blox-btn--ghost" onClick={() => setShowEdit((v) => !v)}>
              {showEdit ? t('ops.common.cancel') : t('ops.common.manage')}
            </button>
          </div>
          {showEdit && (
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {actions.assignCompany && (
                <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
                  Company
                  <select value={editCompanyId} onChange={(e) => setEditCompanyId(e.target.value)}>
                    {(companies.data?.items ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {data.company?.id && (
                <label style={{ display: 'grid', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
                  {t('ops.workspace.selectAgent')}
                  <select value={editAgentId} onChange={(e) => setEditAgentId(e.target.value)}>
                    <option value="">{t('ops.common.dash')}</option>
                    {(agents.data?.items ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name ?? a.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={editHideInterest}
                  onChange={(e) => setEditHideInterest(e.target.checked)}
                />
                {t('ops.workspace.hideInterest')}
              </label>
              <button
                type="button"
                className="blox-btn blox-btn--primary"
                disabled={patchEdit.isPending}
                onClick={() =>
                  patchEdit.mutate({
                    hideInterest: editHideInterest,
                    agentUserId: editAgentId || null,
                    companyId: editCompanyId || undefined,
                  })
                }
              >
                {patchEdit.isPending ? t('ops.common.saving') : t('ops.workspace.saveChanges')}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'overview' && (
        <OpsDetailGrid
          main={
            <>
              <CustomerInfoOverview
                snapshot={snap}
                customerEmail={data.customer_email ?? data.customer?.email}
                customerName={data.customer?.name}
                customerPhone={data.customer?.phone}
              />
              <section className="blox-detail-section" style={{ marginTop: 16 }}>
                <h2 className="blox-panel__title">{t('ops.credit.applicantPlan')}</h2>
                <div className="blox-info-item"><strong>{t('ops.credit.offer')}</strong><span>{data.offer?.name ?? '—'}</span></div>
                <div className="blox-info-item"><strong>{t('ops.credit.vehiclePrice')}</strong><span>QAR {Number(pricing.list_price ?? pricing.selling_price ?? 0).toLocaleString()}</span></div>
                <div className="blox-info-item"><strong>{t('ops.credit.monthlyInstallment')}</strong><span>QAR {Number(pricing.monthly ?? 0).toLocaleString()}</span></div>
                {data.agent && (
                  <div className="blox-info-item"><strong>{t('ops.credit.agent')}</strong><span>{data.agent.name ?? data.agent.email}</span></div>
                )}
              </section>
            </>
          }
          aside={
            <>
              {showAssetDistribution && (
                <section className="blox-detail-section">
                  <h2 className="blox-panel__title">{t('ownership.assetDistribution')}</h2>
                  <HorizontalBarChart
                    label={t('ownership.ownedByYou')}
                    value={customerPct}
                    color={bloxTokens.emerald}
                  />
                  <HorizontalBarChart
                    label={t('ownership.ownedByBlox')}
                    value={bloxPct}
                    color={bloxTokens.slate}
                  />
                  <SegmentedBarChart
                    label={t('ownership.currentOwnership')}
                    segments={[
                      { label: t('ownership.customerShare'), value: customerPct, color: bloxTokens.emerald },
                      { label: t('ownership.bloxShare'), value: bloxPct, color: bloxTokens.slate },
                    ]}
                  />
                </section>
              )}
              <section className="blox-detail-section">
                <h2 className="blox-panel__title">{t('ops.finance.paymentSummary')}</h2>
                <div className="blox-info-item"><strong>{t('ops.credit.monthlyInstallment')}</strong><span>QAR {Number(pricing.monthly ?? 0).toLocaleString()}</span></div>
                <div className="blox-info-item">
                  <strong>{t('ops.credit.tenure')}</strong>
                  <span>{String((pricing as { tenor?: number }).tenor ?? '—')} {t('ops.common.months', { count: (pricing as { tenor?: number }).tenor ?? 0, defaultValue: 'months' })}</span>
                </div>
              </section>
            </>
          }
        />
      )}

      {tab === 'transactions' && (
        <section className="blox-detail-section">
          <h2 className="blox-panel__title">{t('ops.workspace.tab.transactions')}</h2>
          {(data.payment_transactions ?? []).length === 0 ? (
            <p className="blox-empty">{t('ops.common.noResults')}</p>
          ) : (
            <ul className="blox-list-section" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(data.payment_transactions ?? []).map((txn) => (
                <li key={txn.id} className="blox-info-item">
                  <strong>{txn.gateway}</strong>
                  <span>
                    QAR {txn.amount.toLocaleString()} · {txn.status}
                    {txn.receipt_url && (
                      <>
                        {' '}
                        <a href={txn.receipt_url.startsWith('http') ? txn.receipt_url : apiFileUrl(txn.receipt_url)} target="_blank" rel="noreferrer">
                          Receipt
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'schedule' && (
        <section className="blox-detail-section">
          <h2 className="blox-panel__title">{t('ops.workspace.tab.schedule')}</h2>
          <InstallmentScheduleTable
            installmentPlan={installmentPlan}
            paymentSchedules={data.payment_schedules}
            applicationStatus={data.status}
            vehiclePrice={vehiclePrice}
            projected={data.status !== 'active' && data.status !== 'completed'}
            canConvertDaily={!!actions.convertDaily}
            onConvertDaily={() => convertDaily.mutate()}
            onMarkPaid={
              actions.markInstallmentPaid
                ? (row) => {
                    if (!row.id) return;
                    openPayDialog({
                      id: row.id,
                      sequence: row.sequence ?? 0,
                      amount: row.amount,
                      remaining_amount: row.remainingAmount ?? row.amount,
                      status: String(row.status),
                    });
                  }
                : undefined
            }
          />
          {payTarget && (
            <div className="blox-detail-section" style={{ marginTop: 16, maxWidth: 480 }}>
              <h3 style={{ marginTop: 0 }}>
                {t('ops.finance.recordPaymentTitle', {
                  seq: payTarget.sequence,
                  amount: payTarget.remaining_amount.toLocaleString(),
                })}
              </h3>
              <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 10 }}>
                {t('ops.finance.paymentAmount')}
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
                {t('ops.finance.method')}
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`ops.finance.methodOption.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 14 }}>
                {t('ops.finance.reference')}
                <input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder={t('ops.finance.referencePlaceholder')}
                />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: '0.8125rem', fontWeight: 600, marginBottom: 14 }}>
                Payment proof
                <input type="file" onChange={(e) => setPayProof(e.target.files?.[0] ?? null)} />
                {payProof && <span>{payProof.name}</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="blox-btn blox-btn--primary"
                  disabled={pay.isPending || payAmount <= 0 || payAmount > payTarget.remaining_amount}
                  onClick={() => {
                    setConfirm({
                      title: t('ops.finance.recordPayment'),
                      message: t('ops.finance.confirmPaymentPrompt', {
                        amount: payAmount.toLocaleString(),
                        seq: payTarget.sequence,
                      }),
                      onConfirm: () =>
                        pay.mutate({
                          id: payTarget.id,
                          method: payMethod,
                          reference: payReference,
                          amount: payAmount,
                        }),
                    });
                  }}
                >
                  {pay.isPending ? t('ops.finance.recording') : t('ops.finance.confirmPayment')}
                </button>
                <button type="button" className="blox-btn blox-btn--ghost" onClick={() => setPayTarget(null)}>
                  {t('ops.common.cancel')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'logs' && (
        <section className="blox-detail-section">
          <h2 className="blox-panel__title">{t('ops.workspace.tab.logs')}</h2>
          <ul className="blox-timeline">
            {(data.activity_logs ?? []).map((log) => (
              <li key={log.id}>
                <strong>{new Date(log.created_at).toLocaleString()}</strong>
                <div>
                  {log.actor_email ?? 'system'} · {log.action}
                  {log.from_value || log.to_value ? ` (${log.from_value ?? ''} → ${log.to_value ?? ''})` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'comments' && (
        <section className="blox-detail-section">
          <h2 className="blox-panel__title">{t('ops.workspace.tab.comments')}</h2>
          {(data.comments ?? []).map((c) => (
            <p key={c.id}>
              <strong>{c.actor_email}</strong>: {c.body}
            </p>
          ))}
          {actions.comment && (
            <label style={{ display: 'grid', gap: 6 }}>
              {t('ops.workspace.addComment')}
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              <button type="button" className="blox-btn blox-btn--secondary" disabled={!comment.trim() || postComment.isPending} onClick={() => postComment.mutate()}>
                {t('ops.common.save')}
              </button>
            </label>
          )}
        </section>
      )}

      {tab === 'docs' && (
        <section className="blox-detail-section">
          <h2 className="blox-panel__title">{t('ops.workspace.tab.docs')}</h2>
          {data.contract_generated && (
            <div className="blox-document-card" style={{ marginBottom: 16 }}>
              <div>
                <strong>{t('ops.workspace.contract')}</strong>
              </div>
              <a href={apiFileUrl(`/applications/${id}/contract/file`)} target="_blank" rel="noreferrer">
                {t('ops.workspace.downloadContract')}
              </a>
            </div>
          )}
          {actions.uploadSignedContract && (
            <div style={{ marginBottom: 16, display: 'grid', gap: 8, maxWidth: 480 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{t('ops.workspace.uploadSignedContract')}</p>
              <label className="blox-upload-dropzone">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={(e) => setSignedContractFile(e.target.files?.[0] ?? null)}
                />
                <p style={{ margin: 0 }}>{signedContractFile?.name ?? t('ops.workspace.uploadSignedContract')}</p>
              </label>
              <button
                type="button"
                className="blox-btn blox-btn--primary"
                disabled={!signedContractFile || uploadSignedContract.isPending}
                onClick={() => signedContractFile && uploadSignedContract.mutate(signedContractFile)}
              >
                {uploadSignedContract.isPending ? t('ops.common.saving') : t('ops.workspace.uploadSignedContract')}
              </button>
            </div>
          )}
          <div className="blox-list-section">
            {(data.documents ?? []).map((doc) => (
              <div key={doc.id} className="blox-document-card">
                <div>
                  <strong>{doc.category}</strong>
                </div>
                <a href={apiFileUrl(`/applications/${id}/documents/${doc.id}/file`)} target="_blank" rel="noreferrer">
                  {t('ops.common.view')}
                </a>
              </div>
            ))}
          </div>
          {actions.uploadDocs && (
            <div style={{ marginTop: 16, display: 'grid', gap: 12, maxWidth: 480 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{t('ops.workspace.uploadDocument')}</p>
              {docCategories.map((cat) => (
                <label key={cat} className="blox-upload-dropzone" style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    hidden
                    disabled={uploadDoc.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDoc.mutate({ category: cat, file });
                      e.target.value = '';
                    }}
                  />
                  <p style={{ margin: 0, fontWeight: 600 }}>{t(`ops.wizard.doc.${cat}`, { defaultValue: cat })}</p>
                  <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '0.875rem' }}>
                    {t('ops.workspace.uploadDocument')}
                  </p>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="blox-detail-section" style={{ maxWidth: 640 }}>
        <h2 className="blox-panel__title">{t('ops.credit.actions')}</h2>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: '0.875rem' }}>
          {t('ops.credit.reasonForReject')}
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {actions.submitToCredit && (
            <button type="button" className="blox-btn blox-btn--primary" disabled={busy} onClick={() => submit.mutate()}>
              {t('ops.dealer.submitToCredit')}
            </button>
          )}
          {actions.approveContract && (
            <button type="button" className="blox-btn blox-btn--primary" disabled={busy} onClick={() => approve.mutate()}>
              {t('ops.credit.approveSendContract')}
            </button>
          )}
          {actions.startContractReview && (
            <button type="button" className="blox-btn blox-btn--secondary" disabled={busy} onClick={() => transition.mutate('contract_under_review')}>
              {t('ops.credit.startContractReview')}
            </button>
          )}
          {actions.approveSignedContract && (
            <button type="button" className="blox-btn blox-btn--secondary" disabled={busy} onClick={() => transition.mutate('pending_finance_activation')}>
              {t('ops.credit.approveContract')}
            </button>
          )}
          {actions.requireDownPayment && (
            <button type="button" className="blox-btn blox-btn--ghost" disabled={busy} onClick={() => transition.mutate('down_payment_required')}>
              {t('ops.credit.requireDownPayment')}
            </button>
          )}
          {actions.activate && (
            <button
              type="button"
              className="blox-btn blox-btn--primary"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: t('ops.credit.activateFinancing'),
                  message: t('ops.credit.activateConfirm', { label }),
                  onConfirm: () => activate.mutate(false),
                })
              }
            >
              {t('ops.credit.activateFinancing')}
            </button>
          )}
          {actions.directActivate && data.allow_direct_activate && (
            <button
              type="button"
              className="blox-btn blox-btn--ghost"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: t('ops.credit.directActivate'),
                  message: t('ops.credit.directActivateConfirm', { label }),
                  onConfirm: () => activate.mutate(true),
                })
              }
            >
              {t('ops.credit.directActivate')}
            </button>
          )}
          {actions.requestResubmission && (
            <button type="button" className="blox-btn blox-btn--secondary" disabled={busy} onClick={() => transition.mutate('resubmission_required')}>
              {t('ops.credit.requestResubmission')}
            </button>
          )}
          {actions.reject && (
            <button
              type="button"
              className="blox-btn blox-btn--danger"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: t('ops.common.reject'),
                  message: t('ops.credit.rejectConfirm', { label }),
                  onConfirm: () => transition.mutate('rejected'),
                })
              }
            >
              {t('ops.common.reject')}
            </button>
          )}
          {actions.reopen && (
            <button type="button" className="blox-btn blox-btn--secondary" disabled={busy} onClick={() => transition.mutate('under_review')}>
              {t('ops.credit.reopen')}
            </button>
          )}
          {actions.recordDownPayment && data.status === 'down_payment_required' && (
            <button type="button" className="blox-btn blox-btn--primary" onClick={() => downPay.mutate()}>
              {t('ops.finance.recordDownPayment')}
            </button>
          )}
          {actions.recordDownPayment && data.status === 'down_payment_submitted' && (
            <button type="button" className="blox-btn blox-btn--primary" disabled={busy} onClick={() => transition.mutate('pending_finance_activation')}>
              {t('ops.finance.confirmDownPayment')}
            </button>
          )}
          {actions.complianceCheck && (
            <button type="button" className="blox-btn blox-btn--ghost" onClick={() => compliance.mutate()}>
              {t('ops.credit.complianceCheck')}
            </button>
          )}
        </div>
      </section>
      </OpsDetailPage>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </>
  );
}
