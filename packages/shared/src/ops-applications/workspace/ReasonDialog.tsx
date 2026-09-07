import { useEffect, useState } from 'react';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { ConfirmDialog, OpsTextarea } from '../../ops-ui-v2';

/**
 * Confirm dialog with a mandatory free-text reason — used for every audited
 * action (PII reveal, clearing an identity hold). The reason is what the audit
 * log stores next to the actor, so the confirm stays disabled until it is typed.
 */
export function ReasonDialog({
  open,
  title,
  message,
  label,
  placeholder,
  hint,
  confirmText,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  label: string;
  placeholder?: string;
  hint?: string;
  confirmText: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useOpsLabels();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={t('ops.common.cancel')}
      variant="info"
      busy={busy}
      confirmDisabled={!reason.trim()}
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <OpsTextarea
        label={label}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder={placeholder}
        required
        fullWidth
      />
      {hint ? <p className="blox-field__hint">{hint}</p> : null}
    </ConfirmDialog>
  );
}
