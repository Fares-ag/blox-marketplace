import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, startOfMonth } from '../lib/date-utils';
import { formatMonthsToTenure } from '../lib/tenure';
import { generateInstallmentSchedule } from '../lib/generate-schedule';
import type { InstallmentPlan } from '../types/installment-plan';
import { buildPricingSnapshot, sumInstallmentAmounts } from '../lib/pricing';
import { formatQar, formatPercent } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsSelect } from '../ops-ui-v2/OpsField';
import { InstallmentScheduleTable } from './InstallmentScheduleTable';

export type InstallmentPlanStepProps = {
  vehiclePrice: number;
  offerRate: number;
  minDownPct: number;
  tenureMonths: number;
  downPaymentPct: number;
  hideInterest: boolean;
  onChange: (plan: InstallmentPlan, pricingSnapshot: Record<string, unknown>) => void;
};

export function InstallmentPlanStep({
  vehiclePrice,
  offerRate,
  minDownPct,
  tenureMonths,
  downPaymentPct,
  hideInterest,
  onChange,
}: InstallmentPlanStepProps) {
  const { t } = useOpsLabels();
  const [interval, setInterval] = useState<'Monthly' | 'Daily'>('Monthly');

  const plan = useMemo(() => {
    const snapshot = buildPricingSnapshot({
      listPrice: vehiclePrice,
      annualRatePercent: offerRate,
      minDownPaymentPct: minDownPct,
      tenureMonths,
      downPaymentPct,
    });
    const downPayment = snapshot.down_payment;
    const startDate = addMonths(startOfMonth(new Date()), 1);

    const schedule = generateInstallmentSchedule({
      startDate,
      totalMonths: tenureMonths,
      carValue: vehiclePrice,
      downPayment,
      annualRatePercent: offerRate,
      paymentInterval: interval,
      reviewMode: true,
    });

    const financedTotal = sumInstallmentAmounts(schedule.map((r) => Number(r.amount)));

    const built: InstallmentPlan = {
      tenure: formatMonthsToTenure(tenureMonths),
      interval,
      monthlyAmount: schedule[0]?.amount ?? snapshot.monthly,
      totalAmount: downPayment + financedTotal,
      downPayment,
      schedule,
      annualRentalRate: offerRate / 100,
      calculationMethod: 'amortized_fixed',
    };

    const pricingSnapshot = {
      ...snapshot,
      monthly: built.monthlyAmount,
      financed_total: financedTotal,
      hide_interest: hideInterest,
    };

    return { plan: built, pricingSnapshot };
  }, [vehiclePrice, offerRate, minDownPct, downPaymentPct, tenureMonths, interval, hideInterest]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(plan.plan, plan.pricingSnapshot);
  }, [plan]);

  return (
    <div className="blox-wizard-plan blox-form-grid__full">
      <OpsSelect
        label={t('ops.wizard.paymentInterval')}
        value={interval}
        onChange={(e) => setInterval(e.target.value as 'Monthly' | 'Daily')}
        fullWidth
      >
        <option value="Monthly">{t('ops.wizard.intervalMonthly')}</option>
        <option value="Daily">{t('ops.wizard.intervalDaily')}</option>
      </OpsSelect>

      <div className="blox-wizard-plan__summary">
        <div className="blox-wizard-plan__metric">
          <small>{t('ops.wizard.downPayment')}</small>
          <div>{formatQar(plan.plan.downPayment ?? 0)} ({formatPercent(downPaymentPct)})</div>
        </div>
        <div className="blox-wizard-plan__metric">
          <small>{t('ops.wizard.firstPayment')}</small>
          <div>{formatQar(plan.plan.monthlyAmount)}</div>
        </div>
        <div className="blox-wizard-plan__metric">
          <small>{t('ops.wizard.tenure')}</small>
          <div>{plan.plan.tenure}</div>
        </div>
      </div>

      <InstallmentScheduleTable
        installmentPlan={plan.plan}
        applicationStatus="draft"
        vehiclePrice={vehiclePrice}
        projected
      />
    </div>
  );
}
