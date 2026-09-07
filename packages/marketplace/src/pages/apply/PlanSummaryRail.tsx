import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyText, formatQar, getAppLocale, type PricingSnapshot } from '@drivemarket/shared';

export type PlanVehicle = {
  title: string;
  year: number | null;
  imageUrl: string | null;
  dealerName: string | null;
  conditionLabel: string;
};

type RailProps = {
  vehicle: PlanVehicle;
  pricing: PricingSnapshot;
  tenure: number;
  onChangePlan?: () => void;
  note?: ReactNode;
};

/** Sticky desktop rail: the vehicle and the live plan numbers, always in view. */
export function PlanSummaryRail({ vehicle, pricing, tenure, onChangePlan, note }: RailProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  return (
    <aside className="dm-plan" aria-label={t('applyFlow.plan.title')}>
      <div className="dm-plan__vehicle">
        <div className={`dm-plan__media${vehicle.imageUrl ? '' : ' is-empty'}`} style={vehicle.imageUrl ? { backgroundImage: `url(${vehicle.imageUrl})` } : undefined} aria-hidden />
        <div className="dm-plan__vehicle-copy">
          <p className="dm-plan__eyebrow">{t('applyFlow.plan.vehicle')}</p>
          <h2 className="dm-plan__title">
            {vehicle.title}
            {vehicle.year ? <span className="dm-plan__year dm-numeric"> · {vehicle.year}</span> : null}
          </h2>
          <p className="dm-plan__sub">
            <span className="dm-pill dm-pill--neutral">{vehicle.conditionLabel}</span>
            {vehicle.dealerName ? (
              <span>
                {t('applyFlow.plan.dealer')} {vehicle.dealerName}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="dm-plan__hero">
        <span className="dm-plan__hero-label">{t('applyFlow.plan.monthly')}</span>
        <MoneyText className="dm-plan__hero-value">{formatQar(pricing.monthly, true, locale)}</MoneyText>
      </div>

      <dl className="dm-plan__rows">
        <div>
          <dt>{t('applyFlow.plan.price')}</dt>
          <dd>
            <MoneyText>{formatQar(pricing.list_price, false, locale)}</MoneyText>
          </dd>
        </div>
        <div>
          <dt>{t('applyFlow.plan.tenure')}</dt>
          <dd className="dm-numeric">{t('applyFlow.vehicle.tenureMonths', { months: tenure })}</dd>
        </div>
        <div>
          <dt>{t('applyFlow.plan.downPayment')}</dt>
          <dd>
            <span className="dm-numeric">{pricing.down_payment_pct}%</span> · <MoneyText>{formatQar(pricing.down_payment, false, locale)}</MoneyText>
          </dd>
        </div>
        <div>
          <dt>{t('applyFlow.plan.financed')}</dt>
          <dd>
            <MoneyText>{formatQar(Math.max(pricing.list_price - pricing.down_payment, 0), false, locale)}</MoneyText>
          </dd>
        </div>
        <div>
          <dt>{t('applyFlow.plan.rate')}</dt>
          <dd className="dm-numeric">{pricing.rate}%</dd>
        </div>
        <div>
          <dt>{t('applyFlow.plan.totalPayable')}</dt>
          <dd>
            <MoneyText>{formatQar(pricing.financed_total, false, locale)}</MoneyText>
          </dd>
        </div>
      </dl>

      {note ? <div className="dm-plan__note">{note}</div> : null}

      {onChangePlan ? (
        <button type="button" className="dm-plan__change" onClick={onChangePlan}>
          {t('applyFlow.plan.change')}
        </button>
      ) : null}
      <p className="dm-plan__disclaimer">{t('applyFlow.plan.estimateNote')}</p>
    </aside>
  );
}

type StickyProps = {
  monthly: number;
  primaryLabel: string;
  onPrimary: () => void;
  disabled?: boolean;
  busy?: boolean;
  hidePrimary?: boolean;
};

/** Mobile-only sticky footer with the monthly figure and the step's primary action. */
export function ApplyStickyBar({ monthly, primaryLabel, onPrimary, disabled, busy, hidePrimary }: StickyProps) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  return (
    <div className="dm-apply-sticky" role="region" aria-label={t('applyFlow.plan.title')}>
      <div className="dm-apply-sticky__info">
        <span className="dm-apply-sticky__label">{t('applyFlow.sticky.monthly')}</span>
        <MoneyText className="dm-apply-sticky__value">{formatQar(monthly, true, locale)}</MoneyText>
      </div>
      {!hidePrimary ? (
        <button type="button" className="dm-btn-cta dm-apply-sticky__btn" onClick={onPrimary} disabled={disabled || busy} aria-busy={busy || undefined}>
          {primaryLabel}
        </button>
      ) : null}
    </div>
  );
}
