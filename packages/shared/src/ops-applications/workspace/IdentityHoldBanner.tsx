import { useOpsLabels } from '../../i18n/use-ops-labels';
import { Alert } from '../../ops-ui-v2';
import { OpsSecondaryButton } from '../../components/ops-ui';
import type { OpsWorkspace } from '../types';

/** True while the intake identity hold is set and nobody has cleared it. */
export function isIdentityHoldActive(
  data: Pick<OpsWorkspace, 'identity_hold_reason' | 'identity_hold_cleared_at'>,
): boolean {
  return !!data.identity_hold_reason && !data.identity_hold_cleared_at;
}

/**
 * Identity-hold banner — shown above the facts strip while the hold is active.
 * The clear action is offered to credit / admin only; the note they type is
 * written to the audit log by the API.
 */
export function IdentityHoldBanner({
  data,
  canClear,
  onClear,
  busy,
}: {
  data: OpsWorkspace;
  canClear: boolean;
  onClear: () => void;
  busy?: boolean;
}) {
  const { t } = useOpsLabels();
  if (!isIdentityHoldActive(data)) return null;

  const reason = data.identity_hold_reason ?? '';
  const reasonLabel = t(`dealerOps.workspace.holdReason.${reason}`, { defaultValue: reason.replace(/_/g, ' ') });
  const heldAt = data.identity_hold_at ? new Date(data.identity_hold_at).toLocaleString() : null;

  return (
    <Alert
      variant="warning"
      title={t('identityHold.title')}
      action={
        canClear ? (
          <OpsSecondaryButton type="button" size="sm" loading={busy} onClick={onClear}>
            {t('identityHold.clear')}
          </OpsSecondaryButton>
        ) : undefined
      }
    >
      <p className="blox-m-0">{t('identityHold.body')}</p>
      <p className="blox-m-0">
        <strong>{t('identityHold.reason')}:</strong> {reasonLabel}
        {heldAt ? ` · ${t('identityHold.heldAt', { date: heldAt })}` : ''}
      </p>
    </Alert>
  );
}
