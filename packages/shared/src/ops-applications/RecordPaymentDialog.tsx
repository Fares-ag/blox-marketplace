import { useEffect, useState } from 'react';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { ConfirmDialog } from '../ops-ui-v2';
import { OpsField, OpsSelect } from '../ops-ui-v2/OpsField';

const PAY_METHODS = ['bank_transfer', 'card', 'cash', 'cheque'] as const;

export type RecordPaymentTarget = {
  id: string;
  sequence: number;
  remaining_amount: number;
  customer_name?: string | null;
  customer_email?: string;
  vehicle?: string;
};

export function RecordPaymentDialog({
  target,
  busy,
  onClose,
  onConfirm,
}: {
  target: RecordPaymentTarget | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: { method: string; reference: string; amount: number }) => void;
}) {
  const { t } = useOpsLabels();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (!target) return;
    setAmount(target.remaining_amount);
    setMethod('bank_transfer');
    setReference('');
  }, [target]);

  const amountInvalid = !target || amount <= 0 || amount > target.remaining_amount;

  return (
    <ConfirmDialog
      open={!!target}
      title={
        target
          ? t('ops.finance.recordPaymentTitle', {
              seq: target.sequence,
              amount: target.remaining_amount.toLocaleString(),
            })
          : t('ops.finance.recordPayment')
      }
      message={
        target
          ? [target.customer_name ?? target.customer_email, target.vehicle].filter(Boolean).join(' · ')
          : ''
      }
      confirmText={t('ops.finance.confirmPayment')}
      cancelText={t('ops.common.cancel')}
      busy={busy}
      confirmDisabled={amountInvalid}
      onCancel={onClose}
      onConfirm={() => {
        if (!target || amountInvalid) return;
        onConfirm({ method, reference, amount });
      }}
    >
      <div className="blox-form-grid">
        <OpsField
          label={t('ops.finance.paymentAmount')}
          type="number"
          min={0.01}
          max={target?.remaining_amount}
          step={0.01}
          value={amount || ''}
          onChange={(e) => setAmount(Number(e.target.value))}
          mono
          required
          error={
            target && amount > target.remaining_amount
              ? t('ops.workspace.amountTooHigh', { max: target.remaining_amount.toLocaleString() })
              : undefined
          }
        />
        <OpsSelect label={t('ops.finance.method')} value={method} onChange={(e) => setMethod(e.target.value)}>
          {PAY_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`ops.finance.methodOption.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
            </option>
          ))}
        </OpsSelect>
        <OpsField
          label={t('ops.finance.reference')}
          fullWidth
          mono
          optionalLabel
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t('ops.finance.referencePlaceholder')}
        />
      </div>
    </ConfirmDialog>
  );
}
