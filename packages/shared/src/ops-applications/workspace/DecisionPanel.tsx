import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsTextarea } from '../../ops-ui-v2';
import { OpsDangerButton, OpsGhostButton, OpsPrimaryButton, OpsSecondaryButton } from '../../components/ops-ui';
import type { WorkspacePanelProps } from './types';

type Props = WorkspacePanelProps & {
  reason: string;
  onReasonChange: (value: string) => void;
};

/**
 * Decision panel — Phase 1 §11. The one emphasised card: what to decide next, the reason
 * field (written to the customer and the audit log), the primary action full width, the
 * alternatives in a row, and destructive actions last.
 */
export function DecisionPanel({ data, actions, mutations, label, setConfirm, reason, onReasonChange }: Props) {
  const { t } = useOpsLabels();
  const busy = mutations.busy;
  const nextKey = `ops.workspace.next.${data.status}`;

  const primary: Array<{ key: string; label: string; onClick: () => void }> = [];
  const secondary: Array<{ key: string; label: string; onClick: () => void }> = [];
  const tertiary: Array<{ key: string; label: string; onClick: () => void }> = [];
  const destructive: Array<{ key: string; label: string; onClick: () => void }> = [];

  if (actions.submitToCredit) primary.push({ key: 'submit', label: t('ops.dealer.submitToCredit'), onClick: () => mutations.submit.mutate() });
  if (actions.approveContract) primary.push({ key: 'approve', label: t('ops.credit.approveSendContract'), onClick: () => mutations.approve.mutate() });
  if (actions.approveForFinance)
    (primary.length ? secondary : primary).push({
      key: 'approveForFinance',
      label: t('ops.credit.approveForFinance'),
      onClick: () =>
        setConfirm({
          title: t('ops.credit.approveForFinance'),
          message: t('ops.credit.approveForFinanceConfirm', { label }),
          onConfirm: () => mutations.transition.mutate('pending_finance_activation'),
        }),
    });
  if (actions.startContractReview) primary.push({ key: 'startReview', label: t('ops.credit.startContractReview'), onClick: () => mutations.transition.mutate('contract_under_review') });
  if (actions.approveSignedContract) primary.push({ key: 'approveSigned', label: t('ops.credit.approveContract'), onClick: () => mutations.transition.mutate('pending_finance_activation') });
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
    });
  if (actions.recordDownPayment && data.status === 'down_payment_required')
    primary.push({ key: 'recordDp', label: t('ops.finance.recordDownPayment'), onClick: () => mutations.downPay.mutate() });
  if (actions.recordDownPayment && data.status === 'down_payment_submitted')
    primary.push({ key: 'confirmDp', label: t('ops.finance.confirmDownPayment'), onClick: () => mutations.transition.mutate('pending_finance_activation') });
  if (actions.reopen) primary.push({ key: 'reopen', label: t('ops.credit.reopen'), onClick: () => mutations.transition.mutate('under_review') });

  if (actions.requestResubmission) secondary.push({ key: 'resubmission', label: t('ops.credit.requestResubmission'), onClick: () => mutations.transition.mutate('resubmission_required') });
  if (actions.requireDownPayment) secondary.push({ key: 'requireDp', label: t('ops.credit.requireDownPayment'), onClick: () => mutations.transition.mutate('down_payment_required') });
  if (actions.recoverDownPayment) secondary.push({ key: 'recoverDp', label: t('ops.credit.collectDownPayment'), onClick: () => mutations.transition.mutate('down_payment_required') });

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
          onConfirm: () => mutations.transition.mutate('rejected'),
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
          onConfirm: () => mutations.transition.mutate('submission_cancelled'),
          danger: true,
        }),
    });

  const anyAction = primary.length + secondary.length + tertiary.length + destructive.length > 0;
  const needsReason = actions.reject || actions.requestResubmission || actions.cancel;

  return (
    <section className="blox-detail-section blox-decision" aria-labelledby="blox-decision-title">
      <p className="blox-decision__eyebrow">{t('ops.workspace.nextDecision')}</p>
      <h2 id="blox-decision-title" className="blox-decision__title">
        {t(nextKey, { defaultValue: t('ops.workspace.next.default') })}
      </h2>
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
            <OpsPrimaryButton key={a.key} type="button" disabled={busy} onClick={a.onClick}>
              {a.label}
            </OpsPrimaryButton>
          ))}
          {(secondary.length > 0 || destructive.length > 0) && (
            <div className="blox-decision__row">
              {secondary.map((a) => (
                <OpsSecondaryButton key={a.key} type="button" disabled={busy} onClick={a.onClick}>
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
    </section>
  );
}
