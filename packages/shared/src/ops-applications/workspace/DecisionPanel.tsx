import { useState } from 'react';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { useAuthStore } from '../../auth/auth-store';
import { Alert, OpsTextarea } from '../../ops-ui-v2';
import { OpsDangerButton, OpsGhostButton, OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../../components/ops-ui';
import { HARD_CAP_PERCENT } from '../../lib/credit-assessment';
import {
  approveBlockReason,
  creditPathVariant,
  decisionErrorCode,
  effectiveAffordability,
  formatDbrPct,
  roleListLabel,
} from '../credit-decision';
import { ReasonDialog } from './ReasonDialog';
import type { WorkspacePanelProps } from './types';

type Props = WorkspacePanelProps & {
  reason: string;
  onReasonChange: (value: string) => void;
};

type Action = { key: string; label: string; onClick: () => void; disabled?: boolean; title?: string };

/**
 * Decision panel — Phase 1 §11. The one emphasised card: what to decide next, the reason
 * field (written to the customer and the audit log), the primary action full width, the
 * alternatives in a row, and destructive actions last.
 *
 * Wave 2: the credit assessment gates the approval buttons (approval matrix and DBR
 * exception tier for the signed-in role, hard cap for everyone but a super admin) and a
 * `dbr_above_hard_cap` refusal opens the super-admin override-reason dialog.
 */
export function DecisionPanel({ data, actions, mutations, label, setConfirm, reason, onReasonChange, platform }: Props) {
  const { t } = useOpsLabels();
  const role = useAuthStore((s) => s.user?.role ?? null);
  const busy = mutations.busy;
  const nextKey = `ops.workspace.next.${data.status}`;
  const [override, setOverride] = useState<{ retry: (overrideReason: string) => void } | null>(null);

  const assessment = platform?.creditAssessment ?? data.credit_assessment ?? null;
  const approvalStage = data.status === 'under_review';
  const block = approvalStage ? approveBlockReason({ assessment, role, t }) : null;
  const effective = effectiveAffordability(assessment);
  const hardCapPct = effective ? Math.round(Number(effective.hard_cap) * 100) : HARD_CAP_PERCENT;

  /** A hard-cap refusal for a super admin becomes the override dialog; anything else stays an error. */
  function maybeOverride(error: Error, retry: (overrideReason: string) => void) {
    if (role === 'super_admin' && decisionErrorCode(error) === 'dbr_above_hard_cap') setOverride({ retry });
  }
  function runApprove(overrideReason?: string) {
    mutations.approve.mutate(overrideReason ? { override_reason: overrideReason } : undefined, {
      onError: (e) => maybeOverride(e, runApprove),
    });
  }
  function runTransition(toStatus: string, overrideReason?: string) {
    mutations.transition.mutate(overrideReason ? { toStatus, override_reason: overrideReason } : toStatus, {
      onError: (e) => maybeOverride(e, (next) => runTransition(toStatus, next)),
    });
  }

  const primary: Action[] = [];
  const secondary: Action[] = [];
  const tertiary: Action[] = [];
  const destructive: Action[] = [];
  const gated = block ? { disabled: true, title: block.message } : {};

  if (actions.submitToCredit) primary.push({ key: 'submit', label: t('ops.dealer.submitToCredit'), onClick: () => mutations.submit.mutate() });
  if (actions.approveContract)
    primary.push({ key: 'approve', label: t('ops.credit.approveSendContract'), onClick: () => runApprove(), ...gated });
  if (actions.approveForFinance)
    (primary.length ? secondary : primary).push({
      key: 'approveForFinance',
      label: t('ops.credit.approveForFinance'),
      onClick: () =>
        setConfirm({
          title: t('ops.credit.approveForFinance'),
          message: t('ops.credit.approveForFinanceConfirm', { label }),
          onConfirm: () => runTransition('pending_finance_activation'),
        }),
      ...gated,
    });
  if (actions.startContractReview) primary.push({ key: 'startReview', label: t('ops.credit.startContractReview'), onClick: () => runTransition('contract_under_review') });
  if (actions.approveSignedContract) primary.push({ key: 'approveSigned', label: t('ops.credit.approveContract'), onClick: () => runTransition('pending_finance_activation') });
  if (actions.activate)
    primary.push({
      key: 'activate',
      label: t('ops.credit.activateFinancing'),
      onClick: () =>
        setConfirm({
          title: t('ops.credit.activateFinancing'),
          message: t('ops.credit.activateConfirm', { label }),
          onConfirm: () => mutations.activate.mutate(false),
        }),
      ...(approvalStage ? gated : {}),
    });
  if (actions.recordDownPayment && data.status === 'down_payment_required')
    primary.push({ key: 'recordDp', label: t('ops.finance.recordDownPayment'), onClick: () => mutations.downPay.mutate() });
  if (actions.recordDownPayment && data.status === 'down_payment_submitted')
    primary.push({ key: 'confirmDp', label: t('ops.finance.confirmDownPayment'), onClick: () => runTransition('pending_finance_activation') });
  if (actions.reopen) primary.push({ key: 'reopen', label: t('ops.credit.reopen'), onClick: () => runTransition('under_review') });

  if (actions.requestResubmission) secondary.push({ key: 'resubmission', label: t('ops.credit.requestResubmission'), onClick: () => runTransition('resubmission_required') });
  if (actions.requireDownPayment) secondary.push({ key: 'requireDp', label: t('ops.credit.requireDownPayment'), onClick: () => runTransition('down_payment_required') });
  if (actions.recoverDownPayment) secondary.push({ key: 'recoverDp', label: t('ops.credit.collectDownPayment'), onClick: () => runTransition('down_payment_required') });

  if (actions.activateAdmin)
    tertiary.push({
      key: 'activateAdmin',
      label: t('ops.credit.activateAdmin'),
      onClick: () =>
        setConfirm({
          title: t('ops.credit.activateAdmin'),
          message: t('ops.credit.activateAdminConfirm', { label }),
          onConfirm: () => mutations.activate.mutate(false),
        }),
      ...(approvalStage ? gated : {}),
    });
  if (actions.directActivate && data.allow_direct_activate)
    tertiary.push({
      key: 'directActivate',
      label: t('ops.credit.directActivate'),
      onClick: () =>
        setConfirm({
          title: t('ops.credit.directActivate'),
          message: t('ops.credit.directActivateConfirm', { label }),
          onConfirm: () => mutations.activate.mutate(true),
        }),
      ...(approvalStage ? gated : {}),
    });
  if (actions.complianceCheck) tertiary.push({ key: 'compliance', label: t('ops.credit.complianceCheck'), onClick: () => mutations.compliance.mutate() });

  if (actions.reject)
    destructive.push({
      key: 'reject',
      label: t('ops.common.reject'),
      onClick: () =>
        setConfirm({
          title: t('ops.common.reject'),
          message: t('ops.credit.rejectConfirm', { label }),
          onConfirm: () => runTransition('rejected'),
          danger: true,
        }),
    });
  if (actions.cancel)
    destructive.push({
      key: 'cancel',
      label: t('ops.common.cancelApplication'),
      onClick: () =>
        setConfirm({
          title: t('ops.common.cancelApplication'),
          message: t('ops.common.cancelApplicationConfirm', { label }),
          onConfirm: () => runTransition('submission_cancelled'),
          danger: true,
        }),
    });

  const anyAction = primary.length + secondary.length + tertiary.length + destructive.length > 0;
  const needsReason = actions.reject || actions.requestResubmission || actions.cancel;
  const showSummary = approvalStage && (actions.approveContract || actions.approveForFinance);

  return (
    <section className="blox-detail-section blox-decision" aria-labelledby="blox-decision-title">
      <p className="blox-decision__eyebrow">{t('ops.workspace.nextDecision')}</p>
      <h2 id="blox-decision-title" className="blox-decision__title">
        {t(nextKey, { defaultValue: t('ops.workspace.next.default') })}
      </h2>

      {showSummary &&
        (assessment ? (
          <div className="blox-cell-row blox-cell-row--wrap">
            <OpsStatusPill
              label={t(`dealerOps.creditAssessment.path.${assessment.path}`, { defaultValue: assessment.path })}
              variant={creditPathVariant(assessment.path)}
            />
            {effective && (
              <span className="blox-muted">
                {t('dealerOps.creditAssessment.dbrValue', { dbr: formatDbrPct(effective.dbr) })} ·{' '}
                {t('dealerOps.creditAssessment.cap', { cap: Math.round(Number(effective.cap) * 100) })}
              </span>
            )}
            {assessment.approver && (
              <OpsStatusPill
                label={
                  assessment.approver.role_may_approve
                    ? t('dealerOps.creditAssessment.youMayApprove')
                    : t('dealerOps.creditAssessment.youMayNotApprove', {
                        roles: roleListLabel(assessment.approver.required_roles, t),
                      })
                }
                variant={assessment.approver.role_may_approve ? 'success' : 'warning'}
              />
            )}
          </div>
        ) : platform?.creditAssessmentPending ? (
          <p className="blox-muted">{t('dealerOps.decision.assessmentPending')}</p>
        ) : null)}

      {block && (
        <Alert variant="warning" title={t('dealerOps.decision.blockedApprove')}>
          <p className="blox-m-0">{block.message}</p>
          <p className="blox-m-0">{t('dealerOps.decision.blockedHint')}</p>
        </Alert>
      )}

      {needsReason && (
        <OpsTextarea
          label={t('ops.credit.reasonForReject')}
          optionalLabel={t('ops.workspace.reasonOptionalHint')}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          placeholder={t('ops.workspace.reasonPlaceholder')}
        />
      )}
      {anyAction ? (
        <div className="blox-decision__actions">
          {primary.map((a) => (
            <OpsPrimaryButton key={a.key} type="button" disabled={busy || a.disabled} title={a.title} onClick={a.onClick}>
              {a.label}
            </OpsPrimaryButton>
          ))}
          {(secondary.length > 0 || destructive.length > 0) && (
            <div className="blox-decision__row">
              {secondary.map((a) => (
                <OpsSecondaryButton key={a.key} type="button" disabled={busy || a.disabled} title={a.title} onClick={a.onClick}>
                  {a.label}
                </OpsSecondaryButton>
              ))}
              {destructive.map((a) => (
                <OpsDangerButton key={a.key} type="button" disabled={busy} onClick={a.onClick}>
                  {a.label}
                </OpsDangerButton>
              ))}
            </div>
          )}
          {tertiary.length > 0 && (
            <div className="blox-decision__row blox-decision__row--tertiary">
              {tertiary.map((a) => (
                <OpsGhostButton key={a.key} type="button" disabled={busy} onClick={a.onClick}>
                  {a.label}
                </OpsGhostButton>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="blox-decision__none">{t('ops.workspace.noActions')}</p>
      )}

      <ReasonDialog
        open={!!override}
        title={t('dealerOps.decision.overrideTitle')}
        message={t('dealerOps.decision.overrideBody', { cap: hardCapPct })}
        label={t('dealerOps.decision.overrideReason')}
        placeholder={t('dealerOps.decision.overridePlaceholder')}
        hint={t('dealerOps.decision.overrideLogged')}
        confirmText={t('dealerOps.decision.overrideConfirm')}
        busy={busy}
        onCancel={() => setOverride(null)}
        onConfirm={(text) => {
          const retry = override?.retry;
          setOverride(null);
          retry?.(text);
        }}
      />
    </section>
  );
}
