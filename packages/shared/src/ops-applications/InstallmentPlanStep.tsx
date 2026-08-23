import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, startOfMonth } from '../lib/date-utils';
import { formatMonthsToTenure } from '../lib/tenure';
import { generateInstallmentSchedule } from '../lib/generate-schedule';
import type { InstallmentPlan } from '../types/installment-plan';
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
  tenureMonths,
  downPaymentPct,
  hideInterest,
  onChange,
}: InstallmentPlanStepProps) {
  const { t } = useOpsLabels();
  const [interval, setInterval] = useState<'Monthly' | 'Daily'>('Monthly');

  const plan = useMemo(() => {
    const downPayment = (vehiclePrice * downPaymentPct) / 100;
    const loanAmount = Math.max(vehiclePrice - downPayment, 0);
    const annualRentalRate = offerRate / 100;
    const principalPerMonth = tenureMonths > 0 ? loanAmount / tenureMonths : 0;
    const initialRent = loanAmount * (annualRentalRate / 12);
    const firstMonthPayment = principalPerMonth + initialRent;
    const startDate = addMonths(startOfMonth(new Date()), 1);

    const schedule = generateInstallmentSchedule({
      monthlyPayment: firstMonthPayment,
      startDate,
      totalMonths: tenureMonths,
      carValue: vehiclePrice,
      downPayment,
      annualRentalRate,
      paymentInterval: interval,
      reviewMode: true,
    });

    const financedTotal = schedule.reduce((s, r) => s + Number(r.amount), 0);

    const built: InstallmentPlan = {
      tenure: formatMonthsToTenure(tenureMonths),
      interval,
      monthlyAmount:
        schedule.find((r) => r.paymentType !== 'down_payment')?.amount ?? firstMonthPayment,
      totalAmount: vehiclePrice + (financedTotal - loanAmount),
      downPayment,
      schedule,
      annualRentalRate,
      calculationMethod: 'dynamic_rent',
    };

    const pricingSnapshot = {
      list_price: vehiclePrice,
      down_payment: downPayment,
      down_payment_pct: downPaymentPct,
      tenor: tenureMonths,
      rate: offerRate,
      monthly: built.monthlyAmount,
      financed_total: financedTotal,
      hide_interest: hideInterest,
    };

    return { plan: built, pricingSnapshot };
  }, [vehiclePrice, offerRate, downPaymentPct, tenureMonths, interval, hideInterest]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(plan.plan, plan.pricingSnapshot);
  }, [plan]);

  return (
    <div className="blox-wizard-plan">
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

      <p className="blox-wizard-plan__note">{t('ops.workspace.scheduleProjected')}</p>

      <InstallmentScheduleTable
        installmentPlan={plan.plan}
        applicationStatus="draft"
        vehiclePrice={vehiclePrice}
        projected
      />
    </div>
  );
}
