import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { applicationOpsPillVariant } from '../config/status-styles';
import { useAuthStore } from '../auth/auth-store';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { Alert, ConfirmDialog, OpsDetailPage, PageSkeleton } from '../ops-ui-v2';
import { calculateOwnershipTimeline } from '../lib/ownership';
import { resolveDisplaySchedule } from '../lib/resolve-display-schedule';
import type { InstallmentPlan } from '../types/installment-plan';
import type { ConsentStatusDto } from '../types/customer-platform';
import type { OpsAudience, OpsUnmaskField, OpsWorkspace } from './types';
import { canCreditDecide, isFullAdminRole, visibleWorkspaceActions } from './useApplicationActions';
import { submitGateMessage } from './submit-gate';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import { useWorkspaceMutations } from './workspace/useWorkspaceMutations';
import { WorkspaceFacts } from './workspace/WorkspaceFacts';
import { IdentityHoldBanner } from './workspace/IdentityHoldBanner';
import { ReasonDialog } from './workspace/ReasonDialog';
import { TagLenderDialog } from './workspace/TagLenderDialog';
import { OverviewTab } from './workspace/OverviewTab';
import { TransactionsTab } from './workspace/TransactionsTab';
import { ScheduleTab } from './workspace/ScheduleTab';
import { LogsTab } from './workspace/LogsTab';
import { CommentsTab } from './workspace/CommentsTab';
import { DocsTab } from './workspace/DocsTab';
import { EditPanel } from './workspace/EditPanel';
import { DecisionPanel } from './workspace/DecisionPanel';
import type { ConfirmRequest, WorkspacePanelProps, WorkspacePlatformProps } from './workspace/types';

const TABS = ['overview', 'transactions', 'schedule', 'logs', 'comments', 'docs'] as const;
type Tab = (typeof TABS)[number];

type ReasonRequest = { kind: 'unmask'; field: OpsUnmaskField } | { kind: 'clearHold' };

/**
 * Application workspace — Phase 1 §11. This component is routing and layout only:
 * the query, the action gate, the header, the facts strip and the tab switch.
 * Server actions live in `useWorkspaceMutations`, each tab in `./workspace/*Tab.tsx`.
 *
 * Customer-platform additions wired here: masked identity with audited reveal,
 * identity hold + clear, consents status, lender tagging and takaful verification.
 */
export function ApplicationWorkspace({
  id,
  audience,
  backTo,
}: {
  id: string;
  audience: OpsAudience;
  /** Override the back link; defaults to the portal-aware queue/list route. */
  backTo?: string;
}) {
  const portalBase = usePortalBasePath();
  const backHref = backTo ?? withPortalBase(audience === 'credit' ? '/queue' : '/applications', portalBase);
  const backLabelKey = audience === 'credit' || audience === 'finance' ? 'ops.common.backToQueue' : 'ops.common.backToApplications';
  const { t, applicationStatus } = useOpsLabels();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const [tab, setTab] = useState<Tab>('overview');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);
  const [lenderOpen, setLenderOpen] = useState(false);
  const [revealed, setRevealed] = useState<Partial<Record<OpsUnmaskField, string>>>({});

  const { data } = useQuery({
    queryKey: ['ops-app', id],
    queryFn: () => apiFetch<OpsWorkspace>(`/api/applications/${id}`),
    enabled: !!id,
  });

  const consents = useQuery({
    queryKey: ['ops-app-consents', id],
    queryFn: () => apiFetch<ConsentStatusDto>(`/api/ops/applications/${id}/consents`),
    enabled: !!id && !!data,
    retry: false,
  });

  const actions = visibleWorkspaceActions(data?.status ?? 'draft', role);

  const mutations = useWorkspaceMutations(id, {
    backHref,
    getReason: () => reason,
    getComment: () => comment,
    downPaymentAmount: () => Number((data?.pricing_snapshot as { down_payment?: number } | undefined)?.down_payment ?? 0),
    loadCompanies: !!actions.assignCompany,
    // Submit gates come back as machine codes; map them to guidance before showing.
    onError: (message, err) => setError(submitGateMessage(err, t) ?? message),
    onCommentPosted: () => setComment(''),
  });

  if (!data) {
    return (
      <div className="blox-page">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  const dealerRole = role === 'dealer_agent';
  const canClearHold = role === 'credit_officer' || isFullAdminRole(role);
  const canTagLender = role === 'finance_officer' || isFullAdminRole(role);
  const canVerifyTakaful = canCreditDecide(role);
  const revealFields: OpsUnmaskField[] = canCreditDecide(role) ? ['qid', 'phone'] : dealerRole ? ['qid'] : [];

  const customerName = data.customer?.name || data.customer_email || t('ops.workspace.title');
  const vehicleLabel = `${data.product?.make ?? ''} ${data.product?.model ?? ''}`.trim();
  const label = `${vehicleLabel} · ${data.customer?.name ?? data.customer_email}`;
  const submittedAt = data.submitted_at ?? null;
  const idLine = [id, submittedAt ? `${t('ops.workspace.submitted')} ${new Date(submittedAt).toLocaleDateString()}` : null, data.company?.name]
    .filter(Boolean)
    .join(' · ');

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

  const canSeeLogs = audience === 'super_admin' || audience === 'admin' || audience === 'credit';
  const visibleTabs = TABS.filter((name) => name !== 'logs' || canSeeLogs);

  const platform: WorkspacePlatformProps = {
    audience,
    reveal: {
      canReveal: revealFields,
      revealed,
      onReveal: (field) => setReasonRequest({ kind: 'unmask', field }),
      busy: mutations.unmask.isPending,
    },
    consents: consents.data ?? null,
    consentsPending: consents.isLoading,
    consentsError: consents.error ? (consents.error as Error).message : null,
    canVerifyTakaful,
    onVerifyTakaful: (policyId) =>
      mutations.verifyTakaful.mutate(policyId, { onSuccess: () => toast.success(t('dealerOps.takaful.verifiedToast')) }),
    verifyingTakaful: mutations.verifyTakaful.isPending,
    onTagLender: canTagLender ? () => setLenderOpen(true) : undefined,
  };

  const panelProps: WorkspacePanelProps = { id, data, actions, mutations, label, setConfirm, setError, platform };
  const partnerProcessed = data.status === 'partner_processing';

  function onReasonConfirm(text: string) {
    if (!reasonRequest) return;
    setError(null);
    if (reasonRequest.kind === 'unmask') {
      const field = reasonRequest.field;
      mutations.unmask.mutate(
        { field, reason: text },
        {
          onSuccess: (res) => {
            setRevealed((prev) => ({ ...prev, [field]: res.value }));
            setReasonRequest(null);
          },
        },
      );
      return;
    }
    mutations.clearIdentityHold.mutate(text, {
      onSuccess: () => {
        setReasonRequest(null);
        toast.success(t('dealerOps.workspace.holdCleared'));
      },
    });
  }

  const reasonDialog =
    reasonRequest?.kind === 'unmask'
      ? {
          title: t('privacy.revealTitle', { field: t(`privacy.field.${reasonRequest.field}`) }),
          message: t('privacy.revealBody'),
          label: t('privacy.unmaskReason'),
          placeholder: t('privacy.unmaskPlaceholder'),
          hint: t('privacy.unmaskLogged'),
          confirmText: t('privacy.unmask'),
          busy: mutations.unmask.isPending,
        }
      : reasonRequest?.kind === 'clearHold'
        ? {
            title: t('identityHold.clear'),
            message: t('identityHold.clearConfirm'),
            label: t('identityHold.clearReason'),
            placeholder: undefined,
            hint: t('identityHold.noteRequired'),
            confirmText: t('identityHold.clear'),
            busy: mutations.clearIdentityHold.isPending,
          }
        : null;

  const headerActions = (
    <div className="blox-inline-actions">
      {actions.convertDaily && (
        <button type="button" className="blox-btn blox-btn--ghost blox-btn--sm" onClick={() => mutations.convertDaily.mutate()}>
          {t('ops.workspace.convertDailyToMonthly')}
        </button>
      )}
      {actions.editInstallments && (
        <button
          type="button"
          className="blox-btn blox-btn--secondary blox-btn--sm"
          onClick={() => {
            const tenure = Number(window.prompt('Tenure months', String((pricing as { tenor?: number }).tenor ?? 36)));
            const down = Number(window.prompt('Down payment %', String((pricing as { down_payment_pct?: number }).down_payment_pct ?? 10)));
            if (!tenure || !down) return;
            mutations.rebuild.mutate({ tenureMonths: tenure, downPaymentPct: down });
          }}
        >
          {t('ops.workspace.editInstallments')}
        </button>
      )}
      {actions.deleteApp && (
        <button
          type="button"
          className="blox-btn blox-btn--danger blox-btn--sm"
          onClick={() =>
            setConfirm({
              title: t('ops.workspace.deleteTitle'),
              message: t('ops.workspace.deleteConfirm'),
              onConfirm: () => mutations.deleteApp.mutate(),
              danger: true,
            })
          }
        >
          {t('ops.common.delete', { defaultValue: 'Delete' })}
        </button>
      )}
    </div>
  );

  return (
    <>
      <OpsDetailPage
        backTo={backHref}
        backLabel={t(backLabelKey)}
        title={customerName}
        idLabel={idLine}
        status={{ label: applicationStatus(data.status), variant: applicationOpsPillVariant(data.status) }}
        headerActions={headerActions}
        tabs={visibleTabs.map((name) => ({ value: name, label: t(`ops.workspace.tab.${name}`) }))}
        activeTab={tab}
        onTabChange={(v) => setTab(v as Tab)}
      >
        {error && (
          <Alert variant="error" action={<button type="button" className="blox-btn blox-btn--ghost blox-btn--sm" onClick={() => setError(null)}>{t('ops.common.dismiss', { defaultValue: 'Dismiss' })}</button>}>
            {error}
          </Alert>
        )}
        {partnerProcessed && (
          <Alert variant="info" title={t('ops.common.partnerFinance')}>
            {t('ops.common.sentToPartner', { partner: data.finance_partner_name ?? t('ops.common.partnerFinance') })}
          </Alert>
        )}
        <IdentityHoldBanner
          data={data}
          canClear={canClearHold}
          onClear={() => setReasonRequest({ kind: 'clearHold' })}
          busy={mutations.clearIdentityHold.isPending}
        />

        <WorkspaceFacts
          data={data}
          consents={consents.data ?? null}
          consentsPending={consents.isLoading}
          onTagLender={platform.onTagLender}
        />

        {actions.edit && <EditPanel data={data} actions={actions} mutations={mutations} />}

        {tab === 'overview' && (
          <OverviewTab
            {...panelProps}
            reason={reason}
            onReasonChange={setReason}
            customerPct={customerPct}
            bloxPct={bloxPct}
            showOwnership={ownership.vehiclePrice > 0}
            onOpenTab={(next) => setTab(next)}
            canSeeLogs={canSeeLogs}
          />
        )}
        {tab === 'transactions' && <TransactionsTab data={data} />}
        {tab === 'schedule' && <ScheduleTab {...panelProps} installmentPlan={installmentPlan} vehiclePrice={vehiclePrice} />}
        {tab === 'logs' && <LogsTab data={data} />}
        {tab === 'comments' && (
          <CommentsTab data={data} actions={actions} mutations={mutations} comment={comment} onCommentChange={setComment} />
        )}
        {tab === 'docs' && <DocsTab {...panelProps} />}

        {tab !== 'overview' && !partnerProcessed && (
          <div className="blox-decision-footer">
            <DecisionPanel {...panelProps} reason={reason} onReasonChange={setReason} />
          </div>
        )}
      </OpsDetailPage>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        variant={confirm?.danger ? 'danger' : 'info'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
      <ReasonDialog
        open={!!reasonDialog}
        title={reasonDialog?.title ?? ''}
        message={reasonDialog?.message ?? ''}
        label={reasonDialog?.label ?? ''}
        placeholder={reasonDialog?.placeholder}
        hint={reasonDialog?.hint}
        confirmText={reasonDialog?.confirmText ?? ''}
        busy={reasonDialog?.busy}
        onCancel={() => setReasonRequest(null)}
        onConfirm={onReasonConfirm}
      />
      <TagLenderDialog
        open={lenderOpen}
        currentPartnerId={data.finance_partner_id}
        busy={mutations.tagLender.isPending}
        onCancel={() => setLenderOpen(false)}
        onConfirm={(payload) =>
          mutations.tagLender.mutate(payload, {
            onSuccess: () => {
              setLenderOpen(false);
              toast.success(t('dealerOps.workspace.lenderTagged'));
            },
          })
        }
      />
    </>
  );
}
