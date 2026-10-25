import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, formatDateYmd, parseYmd, startOfMonth } from '../lib/date-utils';
import { OpsField, OpsSelect } from '../ops-ui-v2/OpsField';
import { formatMonthsToTenure } from '../lib/tenure';
import { generateInstallmentSchedule } from '../lib/generate-schedule';
import type { InstallmentPlan } from '../types/installment-plan';
import { buildPricingSnapshot, sumInstallmentAmounts } from '../lib/pricing';
import { downPaymentBounds } from '../lib/product-rules';
import {
  balloonPricingOverlay,
  buildBalloonInstallmentPlan,
  isValidBalloonStructure,
  resolveBalloonStructure,
} from '../lib/balloon-payment';
import { formatQar, formatPercent } from '../lib/format';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { Alert, OpsNumberField } from '../ops-ui-v2';
import { InstallmentScheduleTable } from './InstallmentScheduleTable';

export type InstallmentPlanStepProps = {
  vehiclePrice: number;
  offerRate: number;
  minDownPct: number;
  tenureMonths: number;
  downPaymentPct: number;
  hideInterest: boolean;
  allowBalloon?: boolean;
  balloonEnabled?: boolean;
  balloonPct?: number;
  onBalloonEnabledChange?: (enabled: boolean) => void;
  onBalloonPctChange?: (pct: number) => void;
  onChange: (plan: InstallmentPlan, pricingSnapshot: Record<string, unknown>) => void;
};

export function InstallmentPlanStep({
  vehiclePrice,
  offerRate,
  minDownPct,
  tenureMonths,
  downPaymentPct,
  hideInterest,
  allowBalloon = false,
  balloonEnabled = false,
  balloonPct = 0,
  onBalloonEnabledChange,
  onBalloonPctChange,
  onChange,
}: InstallmentPlanStepProps) {
  const { t } = useOpsLabels();
  const [interval, setInterval] = useState<'Monthly' | 'Daily'>('Monthly');
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(() =>
    formatDateYmd(addMonths(startOfMonth(new Date()), 1)),
  );

  const useBalloon = allowBalloon && balloonEnabled;
  const structure = resolveBalloonStructure(downPaymentPct, balloonPct);
  const balloonOk = useBalloon && isValidBalloonStructure(structure);

  const plan = useMemo(() => {
    const snapshot = buildPricingSnapshot({
      listPrice: vehiclePrice,
      annualRatePercent: offerRate,
      minDownPaymentPct: downPaymentBounds().min,
      tenureMonths,
      downPaymentPct,
    });
    const startDate = parseYmd(firstInstallmentDate);

    if (useBalloon && balloonOk) {
      const built = buildBalloonInstallmentPlan({
        vehiclePrice,
        downPaymentPercent: structure.downPaymentPercent,
        balloonPercent: structure.balloonPercent,
        termMonths: tenureMonths,
        annualRatePercent: offerRate,
        startDate,
        interval,
      });
      const pricingSnapshot = {
        ...snapshot,
        ...balloonPricingOverlay(built),
        hide_interest: hideInterest,
        first_installment_date: firstInstallmentDate,
      };
      return { plan: built, pricingSnapshot };
    }

    const downPayment = snapshot.down_payment;
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
      first_installment_date: firstInstallmentDate,
    };

    return { plan: built, pricingSnapshot };
  }, [
    vehiclePrice,
    offerRate,
    minDownPct,
    downPaymentPct,
    tenureMonths,
    interval,
    hideInterest,
    firstInstallmentDate,
    useBalloon,
    balloonOk,
    structure.downPaymentPercent,
    structure.balloonPercent,
  ]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(plan.plan, plan.pricingSnapshot);
  }, [plan]);

  return (
    <div className="blox-wizard-plan blox-form-grid__full">
      {allowBalloon ? (
        <>
          <label className="blox-checkbox-row">
            <input
              type="checkbox"
              checked={balloonEnabled}
              onChange={(e) => onBalloonEnabledChange?.(e.target.checked)}
            />
            <span>{t('dealerOps.plan.balloonToggle')}</span>
          </label>
          {balloonEnabled ? (
            <>
              <Alert variant="info" title={t('dealerOps.plan.balloonTitle')}>
                {t('dealerOps.plan.balloonBody')}
              </Alert>
              <OpsNumberField
                label={t('dealerOps.plan.balloonPct')}
                hint={t('dealerOps.plan.balloonPctHint')}
                min={1}
                max={Math.max(1, 99 - downPaymentPct)}
                step={1}
                emptyValue={30}
                value={balloonPct}
                onValueChange={(pct) => onBalloonPctChange?.(pct)}
              />
              {!balloonOk ? (
                <Alert variant="error" title={t('dealerOps.plan.rulesBlock')}>
                  {t('dealerOps.plan.balloonInvalid')}
                </Alert>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <OpsField
        label={t('ops.wizard.firstInstallmentDate')}
        type="date"
        lang="en-GB"
        value={firstInstallmentDate}
        min={formatDateYmd(new Date())}
        onChange={(e) => setFirstInstallmentDate(e.target.value)}
      />

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
        {useBalloon && balloonOk ? (
          <>
            <div className="blox-wizard-plan__metric">
              <small>{t('dealerOps.plan.installmentShare')}</small>
              <div>{formatPercent(structure.installmentPercent)}</div>
            </div>
            <div className="blox-wizard-plan__metric">
              <small>{t('dealerOps.plan.balloonAmount')}</small>
              <div>
                {formatQar(plan.plan.balloonPayment?.amount ?? 0)} ({formatPercent(structure.balloonPercent)})
              </div>
            </div>
          </>
        ) : null}
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
