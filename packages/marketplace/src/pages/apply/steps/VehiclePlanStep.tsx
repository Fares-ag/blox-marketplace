import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MoneyText,
  formatQar,
  getAppLocale,
  downPaymentBounds,
  recommendedMaxTenureFor,
  tenureBounds,
  type PricingSnapshot,
  type ProductRuleViolation,
  type ResidencyClass,
} from '@drivemarket/shared';
import { ChipRadioGroup, Field, Notice, PercentSlider, TextInput } from '../fields';
import { formatInteger } from '../format';
import type { ApplyPlan, PlanContext } from '../apply-model';
import type { PlanVehicle } from '../PlanSummaryRail';

type Props = {
  ctx: PlanContext;
  vehicle: PlanVehicle;
  plan: ApplyPlan;
  onPlanChange: (plan: ApplyPlan) => void;
  residency: ResidencyClass | null;
  pricing: PricingSnapshot;
  violations: ProductRuleViolation[];
  tenureOptions: number[];
  minDownPct: number;
  adjustedTenure: number | null;
};

export function VehiclePlanStep({
  ctx,
  vehicle,
  plan,
  onPlanChange,
  residency,
  pricing,
  violations,
  tenureOptions,
  minDownPct,
  adjustedTenure,
}: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const hard = violations.filter((v) => v.severity === 'hard');
  const soft = violations.filter((v) => v.severity === 'soft');
  const conditionWord = ctx.condition === 'new' ? t('applyFlow.vehicle.conditionNew') : t('applyFlow.vehicle.conditionUsed');
  const financed = Math.max(ctx.price - pricing.down_payment, 0);
  const tenureBand = tenureBounds();
  const downBand = downPaymentBounds();

  // Local draft for the free-text "choose your own length" input so partially
  // typed or momentarily-empty values are not snapped back to the minimum (3)
  // by the plan normaliser on every keystroke. We only propagate a whole month
  // inside the accepted band, and commit/clamp on blur.
  const [tenureDraft, setTenureDraft] = useState<string>(String(plan.tenure));
  useEffect(() => {
    setTenureDraft(String(plan.tenure));
  }, [plan.tenure]);

  function onCustomTenureChange(raw: string) {
    setTenureDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isInteger(n) && n >= tenureBand.min && n <= tenureBand.max) {
      onPlanChange({ ...plan, tenure: n });
    }
  }

  function commitCustomTenure() {
    const n = Number(tenureDraft);
    if (tenureDraft.trim() === '' || !Number.isFinite(n)) {
      setTenureDraft(String(plan.tenure));
      return;
    }
    const clamped = Math.min(Math.max(Math.round(n), tenureBand.min), tenureBand.max);
    setTenureDraft(String(clamped));
    if (clamped !== plan.tenure) onPlanChange({ ...plan, tenure: clamped });
  }

  function ruleMessage(v: ProductRuleViolation): string {
    const params: Record<string, string | number> = { ...v.params };
    for (const key of ['financed', 'cap']) {
      if (typeof params[key] === 'number') params[key] = formatInteger(params[key] as number, locale);
    }
    return t(`applyFlow.rule.${v.code}`, params);
  }

  return (
    <div className="dm-step">
      <div className="dm-step__vehicle">
        <div className={`dm-step__vehicle-media${vehicle.imageUrl ? '' : ' is-empty'}`} style={vehicle.imageUrl ? { backgroundImage: `url(${vehicle.imageUrl})` } : undefined} aria-hidden />
        <div>
          <p className="dm-step__vehicle-title">
            {vehicle.title}
            {vehicle.year ? <span className="dm-numeric"> · {vehicle.year}</span> : null}
          </p>
          <p className="dm-step__vehicle-meta">
            <span className="dm-pill dm-pill--neutral">{vehicle.conditionLabel}</span>
            <MoneyText>{formatQar(ctx.price, false, locale)}</MoneyText>
            {vehicle.dealerName ? <span className="dm-muted">{t('applyFlow.plan.dealer')} {vehicle.dealerName}</span> : null}
          </p>
        </div>
      </div>

      <h3 className="dm-step__subtitle">{t('applyFlow.vehicle.planTitle')}</h3>

      <ChipRadioGroup
        name="tenure"
        legend={t('applyFlow.vehicle.tenure')}
        hint={
          <>
            {t('applyFlow.vehicle.tenureHint')}
            {residency === 'expat' ? ` ${t('applyFlow.vehicle.tenureCapNote', { max: recommendedMaxTenureFor('expat') })}` : ''}
          </>
        }
        options={tenureOptions.map((m) => ({ value: String(m), label: t('applyFlow.vehicle.tenureMonths', { months: m }) }))}
        value={String(plan.tenure)}
        onChange={(v) => onPlanChange({ ...plan, tenure: Number(v) })}
        required
      />

      <Field
        id="apply-tenure-custom"
        label={t('applyFlow.vehicle.tenureCustom')}
        hint={t('applyFlow.vehicle.tenureCustomHint', { min: tenureBand.min, max: tenureBand.max })}
      >
        {(a11y) => (
          <TextInput
            {...a11y}
            type="number"
            numeric
            inputMode="numeric"
            min={tenureBand.min}
            max={tenureBand.max}
            step={1}
            value={tenureDraft}
            onChange={(e) => onCustomTenureChange(e.target.value)}
            onBlur={commitCustomTenure}
          />
        )}
      </Field>

      <PercentSlider
        id="apply-down-pct"
        label={t('applyFlow.vehicle.downPayment')}
        hint={t('applyFlow.vehicle.downPaymentHint', { min: minDownPct, condition: conditionWord })}
        min={minDownPct}
        max={downBand.max}
        value={plan.downPct}
        onChange={(v) => onPlanChange({ ...plan, downPct: v })}
        valueText={`${plan.downPct}% · ${formatQar(pricing.down_payment, false, locale)}`}
      />
      <p className="dm-step__inline-figure">
        {t('applyFlow.vehicle.downPaymentAmount', { amount: formatQar(pricing.down_payment, false, locale) })}
      </p>

      <dl className="dm-figures">
        <div className="dm-figures__item">
          <dt>{t('applyFlow.vehicle.financed')}</dt>
          <dd>
            <MoneyText>{formatQar(financed, false, locale)}</MoneyText>
          </dd>
        </div>
        <div className="dm-figures__item dm-figures__item--hero">
          <dt>{t('applyFlow.vehicle.monthly')}</dt>
          <dd>
            <MoneyText>{formatQar(pricing.monthly, true, locale)}</MoneyText>
          </dd>
        </div>
        <div className="dm-figures__item">
          <dt>{t('applyFlow.plan.totalPayable')}</dt>
          <dd>
            <MoneyText>{formatQar(pricing.financed_total, false, locale)}</MoneyText>
          </dd>
        </div>
      </dl>

      {adjustedTenure != null ? (
        <Notice tone="info" live="polite">
          {t('applyFlow.vehicle.adjusted', { months: adjustedTenure })}
        </Notice>
      ) : null}

      {hard.length > 0 ? (
        <Notice tone="danger" title={t('applyFlow.vehicle.blockedTitle')}>
          <ul className="dm-notice__list">
            {hard.map((v) => (
              <li key={v.code}>{ruleMessage(v)}</li>
            ))}
          </ul>
          <p>{t('applyFlow.vehicle.blockedBody')}</p>
        </Notice>
      ) : null}

      {soft.length > 0 ? (
        <Notice tone="warn" title={t('applyFlow.vehicle.notesTitle')}>
          <ul className="dm-notice__list">
            {soft.map((v) => (
              <li key={v.code}>{ruleMessage(v)}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}
