import { useState } from 'react';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { OpsField, OpsSelect } from '../../ops-ui-v2';
import { OpsGhostButton, OpsPrimaryButton } from '../../components/ops-ui';
import { InstallmentScheduleTable } from '../InstallmentScheduleTable';
import type { InstallmentPlan } from '../../types/installment-plan';
import type { PayTarget, WorkspacePanelProps } from './types';

const PAY_METHODS = ['bank_transfer', 'card', 'cash', 'cheque'] as const;

type Props = WorkspacePanelProps & {
  installmentPlan: InstallmentPlan | null | undefined;
  vehiclePrice: number;
};

export function ScheduleTab({ data, actions, mutations, setConfirm, setError, installmentPlan, vehiclePrice }: Props) {
  const { t } = useOpsLabels();
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<string>('bank_transfer');
  const [payReference, setPayReference] = useState('');
  const [payProof, setPayProof] = useState<File | null>(null);

  function openPayDialog(row: PayTarget) {
    setError(null);
    setPayTarget(row);
    setPayAmount(row.remaining_amount ?? Number(row.amount ?? 0));
    setPayReference('');
    setPayMethod('bank_transfer');
    setPayProof(null);
  }

  const amountInvalid = !payTarget || payAmount <= 0 || payAmount > payTarget.remaining_amount;

  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.tab.schedule')}</h2>
      <InstallmentScheduleTable
        installmentPlan={installmentPlan}
        paymentSchedules={data.payment_schedules}
        applicationStatus={data.status}
        vehiclePrice={vehiclePrice}
        projected={data.status !== 'active' && data.status !== 'completed'}
        canConvertDaily={!!actions.convertDaily}
        onConvertDaily={() => mutations.convertDaily.mutate()}
        markPaidBlockedReason={data.separation_of_duties_blocked ? t('ops.workspace.markPaidSodBlocked') : undefined}
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
        <div className="blox-detail-section blox-pay-form">
          <h3 className="blox-panel__title">
            {t('ops.finance.recordPaymentTitle', {
              seq: payTarget.sequence,
              amount: payTarget.remaining_amount.toLocaleString(),
            })}
          </h3>
          <div className="blox-form-grid">
            <OpsField
              label={t('ops.finance.paymentAmount')}
              type="number"
              min={0.01}
              max={payTarget.remaining_amount}
              step={0.01}
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              mono
              required
              error={payAmount > payTarget.remaining_amount ? t('ops.workspace.amountTooHigh', { max: payTarget.remaining_amount.toLocaleString() }) : undefined}
            />
            <OpsSelect label={t('ops.finance.method')} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`ops.finance.methodOption.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
                </option>
              ))}
            </OpsSelect>
            <OpsField
              label={t('ops.finance.reference')}
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              placeholder={t('ops.finance.referencePlaceholder')}
              optionalLabel
              mono
            />
            <OpsField
              label={t('ops.workspace.paymentProof')}
              type="file"
              onChange={(e) => setPayProof(e.target.files?.[0] ?? null)}
              hint={payProof?.name}
              optionalLabel
            />
          </div>
          <div className="blox-pay-form__actions">
            <OpsGhostButton type="button" onClick={() => setPayTarget(null)}>
              {t('ops.common.cancel')}
            </OpsGhostButton>
            <OpsPrimaryButton
              type="button"
              disabled={mutations.pay.isPending || amountInvalid}
              loading={mutations.pay.isPending}
              onClick={() => {
                setConfirm({
                  title: t('ops.finance.recordPayment'),
                  message: t('ops.finance.confirmPaymentPrompt', {
                    amount: payAmount.toLocaleString(),
                    seq: payTarget.sequence,
                  }),
                  onConfirm: () =>
                    mutations.pay.mutate(
                      { id: payTarget.id, method: payMethod, reference: payReference, amount: payAmount },
                      { onSuccess: () => setPayTarget(null) },
                    ),
                });
              }}
            >
              {t('ops.finance.confirmPayment')}
            </OpsPrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
