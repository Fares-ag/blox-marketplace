import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MoneyText,
  apiFetch,
  applicationMarketplacePillVariant,
  calculateOwnershipTimeline,
  calculatePlanOwnership,
  overlayRegisterOnTimeline,
  formatQar,
  getAppLocale,
  resolveDisplaySchedule,
  type OwnershipScheduleInput,
} from '@drivemarket/shared';
import { customerApplicationVehicleLabel, type CustomerApplication } from '../lib/application-dto';
import { formatDate, formatMonthYear, localeTag, monthsUntil, parseDate } from '../lib/dates';
import { SETTLEMENT_ERROR_CODES, useSettlementQuote } from '../lib/settlement-quote';
import { hasErrorCode } from '../lib/errors';
import { SettlementQuoteCard } from './SettlementQuoteCard';

/** Statuses whose application carries a live (or finished) co-ownership. */
export const OWNERSHIP_HERO_STATUSES = new Set(['active', 'completed']);

const THRESHOLDS = [25, 50, 75, 100] as const;
type Threshold = (typeof THRESHOLDS)[number];

type Milestone = {
  threshold: Threshold;
  labelKey: string;
  date: string | null;
  reached: boolean;
};

type NextPayment = { id: string; amount: number; dueDate: string; overdue: boolean };

type HeroModel = {
  vehiclePrice: number;
  customerPct: number;
  bloxPct: number;
  customerAmount: number;
  downPct: number;
  paid: number;
  total: number;
  perInstallmentPct: number;
  nextPayment: NextPayment | null;
  milestones: Milestone[];
  nextMilestone: Milestone | null;
  completionDate: string | null;
  monthsToGo: number | null;
  done: boolean;
  hasOverdue: boolean;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Schedule rows for the ownership maths: live schedules once the financing is
 * active, otherwise the installment plan (or a plan-shaped projection from the
 * pricing snapshot) so milestone dates exist before the first payment.
 */
function scheduleInputs(app: CustomerApplication): Array<OwnershipScheduleInput & { id?: string }> {
  if (app.paymentSchedules?.length) {
    return app.paymentSchedules.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      dueDate: s.dueDate,
      amount: s.amount,
      paidAmount: s.paidAmount ?? undefined,
      status: s.status,
    }));
  }
  const pricing = app.pricingSnapshot ?? {};
  const vehiclePrice = Number(pricing.list_price ?? 0);
  if (app.installmentPlan) {
    const rows = resolveDisplaySchedule({
      installmentPlan: app.installmentPlan,
      vehiclePrice,
      isActiveOrLater: false,
    });
    if (rows.length) {
      return rows.map((row, index) => ({
        id: row.id,
        sequence: row.sequence ?? index + 1,
        dueDate: row.dueDate,
        amount: row.amount,
        status: row.status === 'paid' ? 'paid' : 'pending',
      }));
    }
  }
  const tenor = Number(pricing.tenor ?? pricing.tenure ?? 0);
  const monthly = Number(pricing.monthly ?? 0);
  if (!(tenor > 0)) return [];
  const start = parseDate(app.activatedAt) ?? parseDate(app.createdAt) ?? new Date();
  return Array.from({ length: tenor }, (_, i) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i + 1);
    return { sequence: i + 1, dueDate: due.toISOString(), amount: monthly, status: 'pending' };
  });
}

function buildModel(
  app: CustomerApplication,
  register?: { customerUnits: number; totalUnits: number } | null,
): HeroModel {
  const schedules = scheduleInputs(app);
  const timeline = overlayRegisterOnTimeline(
    calculateOwnershipTimeline(app.pricingSnapshot, schedules),
    register,
  );
  const vehiclePrice = timeline.vehiclePrice;
  const done = app.status === 'completed' || timeline.currentOwnership >= 100;
  const customerPct = done ? 100 : round1(timeline.currentOwnership);
  const bloxPct = Math.max(0, round1(100 - customerPct));
  const downPct = vehiclePrice > 0 ? round1((timeline.downPayment / vehiclePrice) * 100) : 0;
  const sorted = [...timeline.milestones].sort((a, b) => a.sequence - b.sequence);
  const nextUnpaid = sorted.find((m) => m.paymentStatus !== 'paid') ?? null;

  let perInstallmentPct = 0;
  if (vehiclePrice > 0) {
    if (nextUnpaid && nextUnpaid.customerShare > 0) {
      perInstallmentPct = round1((nextUnpaid.customerShare / vehiclePrice) * 100);
    } else if (timeline.totalPayments > 0) {
      const plan = calculatePlanOwnership(vehiclePrice, timeline.downPayment, timeline.totalPayments, 0);
      perInstallmentPct = round1((plan.principalPerMonth / vehiclePrice) * 100);
    }
  }

  const milestones: Milestone[] = THRESHOLDS.map((threshold) => {
    const reached = customerPct >= threshold;
    let date: string | null;
    if (downPct >= threshold) {
      date = app.activatedAt ?? null;
    } else {
      const crossing = sorted.find((m) => m.ownershipPercentage >= threshold) ?? null;
      // Reached ahead of the schedule (extra contributions): no exact date to show.
      date = crossing && (!reached || crossing.paymentStatus === 'paid') ? crossing.date : null;
    }
    if (threshold === 100 && app.status === 'completed') date = app.completedAt ?? date;
    return { threshold, labelKey: `ownershipHero.milestone${threshold}`, date, reached };
  });

  const completionDate =
    app.status === 'completed'
      ? (app.completedAt ?? timeline.estimatedCompletionDate)
      : timeline.estimatedCompletionDate;

  let nextPayment: NextPayment | null = null;
  if (!done) {
    const live = [...(app.paymentSchedules ?? [])]
      .filter((s) => s.status !== 'paid' && s.status !== 'waived')
      .sort((a, b) => a.sequence - b.sequence)[0];
    if (live) {
      const due = parseDate(live.dueDate);
      const remaining = Number(live.remainingAmount);
      const amount = Number.isFinite(remaining) && remaining > 0 ? remaining : Number(live.amount);
      nextPayment = {
        id: live.id,
        amount: Number.isFinite(amount) ? amount : 0,
        dueDate: live.dueDate,
        overdue: live.status === 'overdue' || (!!due && due < new Date()),
      };
    }
  }

  return {
    vehiclePrice,
    customerPct,
    bloxPct,
    customerAmount: done ? vehiclePrice : timeline.currentOwnershipAmount,
    downPct,
    paid: timeline.completedPayments,
    total: timeline.totalPayments,
    perInstallmentPct,
    nextPayment,
    milestones,
    nextMilestone: milestones.find((m) => !m.reached) ?? null,
    completionDate,
    monthsToGo: done ? 0 : monthsUntil(completionDate),
    done,
    hasOverdue: !done && timeline.hasOverdue,
  };
}

function OwnershipRing({ pct, label, valueText, caption }: { pct: number; label: string; valueText: string; caption: string }) {
  const size = 176;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (circumference * Math.min(100, Math.max(0, pct))) / 100;
  const centre = size / 2;
  return (
    <svg className="dm-ohero__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle className="dm-ohero__ring-track" cx={centre} cy={centre} r={r} strokeWidth={stroke} fill="none" />
      {filled > 0 && (
        <circle
          className="dm-ohero__ring-fill"
          cx={centre}
          cy={centre}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${Math.max(0, circumference - filled)}`}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
      )}
      <text className="dm-ohero__ring-value" x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy="-8">
        {valueText}
      </text>
      <text className="dm-ohero__ring-caption" x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy="22">
        {caption}
      </text>
    </svg>
  );
}

type Props = {
  /** Detail DTO (with schedules) of the application that carries the co-ownership. */
  app: CustomerApplication | null | undefined;
  /** True while that detail is still loading. */
  loading?: boolean;
};

export function OwnershipHero({ app, loading = false }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const registerQuery = useQuery({
    queryKey: ['ownership-register', app?.id],
    queryFn: () =>
      apiFetch<{ register: { customer_units: number; total_units: number } | null }>(
        `/api/applications/${app!.id}/ownership-register`,
      ),
    enabled: !!app?.id && OWNERSHIP_HERO_STATUSES.has(app.status),
    retry: false,
  });
  const model = useMemo(
    () =>
      app
        ? buildModel(
            app,
            registerQuery.data?.register
              ? {
                  customerUnits: registerQuery.data.register.customer_units,
                  totalUnits: registerQuery.data.register.total_units,
                }
              : null,
          )
        : null,
    [app, registerQuery.data],
  );
  const pctFormatter = useMemo(
    () => new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 1 }),
    [locale],
  );
  const fmtPct = (value: number) => pctFormatter.format(value);

  const payNow = useMutation({
    mutationFn: (scheduleId: string) =>
      apiFetch<{ redirect_url?: string }>(`/api/applications/${app!.id}/schedules/${scheduleId}/skipcash`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      const url = typeof res?.redirect_url === 'string' ? res.redirect_url.trim() : '';
      if (!url) {
        setNotice({ tone: 'error', text: t('ownershipHero.payNowFailed') });
        return;
      }
      window.location.href = url;
    },
    onError: (error: unknown) =>
      setNotice({
        tone: 'error',
        text: hasErrorCode(error, SETTLEMENT_ERROR_CODES.quoteRequired)
          ? t('ownershipHero.settlement.quoteRequired')
          : t('ownershipHero.payNowFailed'),
      }),
  });

  // The early-settlement figure always comes from the API quote (principal
  // outstanding + rent to date); the card below owns the settle action.
  const hasPendingSettlement = app?.settlementRequest?.status === 'pending';
  const settlementActive = !!app && app.status === 'active' && !hasPendingSettlement;
  const settlementQuote = useSettlementQuote(app?.id ?? null, settlementActive);
  const canSettle = !!app && app.status === 'active' && !hasPendingSettlement;

  const styles = <style>{HERO_CSS}</style>;

  if (loading && !app) {
    return (
      <section className="dm-ohero dm-ohero--loading" aria-busy="true" aria-label={t('ownershipHero.title')}>
        <p className="dm-ohero__eyebrow">{t('ownershipHero.eyebrow')}</p>
        <div className="dm-ohero__skeleton" aria-hidden>
          <span className="dm-ohero__skeleton-ring" />
          <span className="dm-ohero__skeleton-lines">
            <span />
            <span />
            <span />
          </span>
        </div>
        <p className="dm-ohero__muted">{t('ownershipHero.loading')}</p>
        {styles}
      </section>
    );
  }

  if (!app || !model) {
    return (
      <section className="dm-ohero dm-ohero--empty" aria-label={t('ownershipHero.title')}>
        <div className="dm-ohero__empty-ring" aria-hidden>
          <OwnershipRing pct={0} label="" valueText="0%" caption="" />
        </div>
        <div className="dm-ohero__empty-copy">
          <p className="dm-ohero__eyebrow">{t('ownershipHero.eyebrow')}</p>
          <h2 className="dm-ohero__empty-title">{t('ownershipHero.noActive')}</h2>
          <p className="dm-ohero__muted">{t('ownershipHero.noActiveBody')}</p>
        </div>
        <div className="dm-ohero__empty-actions">
          <Link className="dm-btn-cta dm-ohero__cta" to="/vehicles">
            {t('ownershipHero.noActiveCta')}
          </Link>
          <Link className="dm-btn-ghost dm-ohero__ghost" to="/eligibility">
            {t('nav.eligibility')}
          </Link>
        </div>
        {styles}
      </section>
    );
  }

  const vehicle = customerApplicationVehicleLabel(app);
  const ringLabel = t('ownershipHero.ringLabel', { customer: fmtPct(model.customerPct), blox: fmtPct(model.bloxPct) });
  const isActive = app.status === 'active';
  const nextMilestoneMonths = model.nextMilestone?.date ? monthsUntil(model.nextMilestone.date) : null;

  return (
    <section className="dm-ohero" aria-label={t('ownershipHero.title')}>
      <div className="dm-ohero__head">
        <p className="dm-ohero__eyebrow">{t('ownershipHero.eyebrow')}</p>
        <span className={`dm-ohero__pill dm-ohero__pill--${applicationMarketplacePillVariant(app.status)}`}>
          {t(`application.status.${app.status}`, { defaultValue: app.status })}
        </span>
      </div>

      <div className="dm-ohero__main">
        <OwnershipRing
          pct={model.customerPct}
          label={ringLabel}
          valueText={`${fmtPct(model.customerPct)}%`}
          caption={t('ownershipHero.ringYours')}
        />
        <div className="dm-ohero__copy">
          <h2 className="dm-ohero__headline">{t('ownershipHero.youOwn', { pct: fmtPct(model.customerPct) })}</h2>
          {vehicle && <p className="dm-ohero__vehicle">{vehicle}</p>}
          <ul className="dm-ohero__facts">
            <li>{t('ownershipHero.bloxOwns', { pct: fmtPct(model.bloxPct) })}</li>
            {model.total > 0 && <li>{t('ownershipHero.installmentsPaid', { paid: model.paid, total: model.total })}</li>}
            {!model.done && model.perInstallmentPct > 0 && (
              <li>{t('ownershipHero.perInstallment', { pct: fmtPct(model.perInstallmentPct) })}</li>
            )}
            {model.downPct > 0 && <li>{t('ownershipHero.initialShare', { pct: fmtPct(model.downPct) })}</li>}
            {model.vehiclePrice > 0 && (
              <li>
                <MoneyText>{formatQar(model.customerAmount, false, locale)}</MoneyText>
                {' / '}
                <MoneyText>{formatQar(model.vehiclePrice, false, locale)}</MoneyText>
              </li>
            )}
          </ul>
        </div>
      </div>

      <ol className="dm-ohero__track" aria-label={t('ownershipHero.milestoneTrack')}>
        {model.milestones.map((m) => (
          <li key={m.threshold} className={`dm-ohero__node${m.reached ? ' is-reached' : ''}`}>
            <span className="dm-ohero__node-dot" aria-hidden>
              {m.reached ? '✓' : ''}
            </span>
            <span className="dm-ohero__node-pct">{m.threshold}%</span>
            <span className="dm-ohero__node-label">{t(m.labelKey)}</span>
            <span className="dm-ohero__node-date">
              {m.reached
                ? m.date
                  ? t('ownershipHero.milestoneReachedOn', { date: formatMonthYear(m.date, locale) })
                  : t('ownershipHero.milestoneReached')
                : m.date
                  ? t('ownershipHero.milestoneExpected', { date: formatMonthYear(m.date, locale) })
                  : '—'}
            </span>
          </li>
        ))}
      </ol>

      <dl className="dm-ohero__tiles">
        <div className={`dm-ohero__tile${model.nextPayment?.overdue ? ' is-warn' : ''}`}>
          <dt>{t('ownershipHero.nextPayment')}</dt>
          {model.nextPayment ? (
            <>
              <dd>
                <MoneyText>{formatQar(model.nextPayment.amount, true, locale)}</MoneyText>
              </dd>
              <small>
                {model.nextPayment.overdue
                  ? t('ownershipHero.nextPaymentOverdue', { date: formatDate(model.nextPayment.dueDate, locale) })
                  : formatDate(model.nextPayment.dueDate, locale)}
              </small>
            </>
          ) : (
            <dd className="dm-ohero__tile-quiet">{t('ownershipHero.nextPaymentNone')}</dd>
          )}
        </div>
        <div className={`dm-ohero__tile${model.done ? ' is-done' : ''}`}>
          <dt>{t('ownershipHero.titleTransfer')}</dt>
          {model.done ? (
            <dd>{t('ownershipHero.titleTransferDone')}</dd>
          ) : (
            <>
              <dd>
                {model.monthsToGo == null
                  ? '—'
                  : model.monthsToGo === 0
                    ? t('ownershipHero.titleTransferThisMonth')
                    : t('ownershipHero.titleTransferIn', { months: model.monthsToGo })}
              </dd>
              {model.completionDate && (
                <small>{t('ownershipHero.titleTransferDate', { date: formatMonthYear(model.completionDate, locale) })}</small>
              )}
            </>
          )}
        </div>
        <div className="dm-ohero__tile">
          <dt>{t('ownershipHero.nextMilestone')}</dt>
          {model.nextMilestone ? (
            <>
              <dd>{t(model.nextMilestone.labelKey)}</dd>
              <small>
                {nextMilestoneMonths != null && nextMilestoneMonths > 0
                  ? t('ownershipHero.milestoneIn', { months: nextMilestoneMonths })
                  : model.nextMilestone.date
                    ? formatMonthYear(model.nextMilestone.date, locale)
                    : `${model.nextMilestone.threshold}%`}
              </small>
            </>
          ) : (
            <dd>{t('ownershipHero.milestoneAllDone')}</dd>
          )}
        </div>
      </dl>

      {model.hasOverdue && (
        <p className="dm-ohero__behind" role="status">
          {t('ownershipHero.behindNote')}
        </p>
      )}

      {notice && (
        <p className={`dm-ohero__notice dm-ohero__notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="dm-ohero__actions">
        {isActive && model.nextPayment && (
          <button
            type="button"
            className="dm-btn-cta dm-ohero__cta"
            disabled={payNow.isPending}
            onClick={() => {
              setNotice(null);
              payNow.mutate(model.nextPayment!.id);
            }}
          >
            {payNow.isPending ? t('ownershipHero.payNowStarting') : t('ownershipHero.payNow')}
          </button>
        )}
        <Link className="dm-btn-ghost dm-ohero__ghost" to={`/app/applications/${app.id}#schedule`}>
          {t('ownershipHero.viewSchedule')}
        </Link>
        <Link className="dm-btn-ghost dm-ohero__ghost" to="/app/calendar">
          {t('ownershipHero.viewCalendar')}
        </Link>
        {isActive && (
          <a className="dm-btn-ghost dm-ohero__ghost" href="#dm-settlement-hero" title={t('ownershipHero.earlySettlementHint')}>
            {t('ownershipHero.earlySettlement')}
          </a>
        )}
        {!isActive && (
          <Link className="dm-btn-ghost dm-ohero__ghost" to={`/app/applications/${app.id}`}>
            {t('ownershipHero.viewPlan')}
          </Link>
        )}
      </div>
      {isActive && (
        <div id="dm-settlement-hero" className="dm-ohero__settlement">
          {hasPendingSettlement ? (
            <p className="dm-ohero__pending" role="status">
              {t('ownershipHero.settlement.pendingReview')}
            </p>
          ) : (
            <SettlementQuoteCard
              applicationId={app.id}
              quote={settlementQuote.data}
              loading={settlementQuote.isLoading}
              error={settlementQuote.isError}
              variant="hero"
              canSettle={canSettle}
              compact
            />
          )}
        </div>
      )}
      {styles}
    </section>
  );
}

const HERO_CSS = `
  .dm-ohero {
    margin-top: 24px;
    padding: 22px 24px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04));
    border: 1px solid rgba(255,255,255,0.16);
    box-shadow: 0 18px 40px rgba(6, 30, 34, 0.25);
    color: #fff;
    display: grid;
    gap: 20px;
  }
  .dm-ohero__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }
  .dm-ohero__eyebrow {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dm-amber);
  }
  .dm-ohero__pill {
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 650;
    background: rgba(255,255,255,0.14);
    color: #fff;
    white-space: nowrap;
  }
  .dm-ohero__pill--approved { background: rgba(0, 207, 162, 0.28); }
  .dm-ohero__pill--action { background: rgba(219, 255, 0, 0.22); }
  .dm-ohero__pill--rejected { background: rgba(255, 99, 71, 0.28); }
  .dm-ohero__main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px 28px;
    align-items: center;
  }
  .dm-ohero__ring { display: block; flex-shrink: 0; }
  .dm-ohero__ring-track { stroke: rgba(255,255,255,0.14); }
  .dm-ohero__ring-fill { stroke: var(--dm-amber); transition: stroke-dasharray 600ms ease; }
  .dm-ohero__ring-value {
    fill: #fff;
    font-family: var(--dm-font-display);
    font-size: 2.1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .dm-ohero__ring-caption {
    fill: rgba(255,255,255,0.72);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dm-ohero__copy { min-width: 0; }
  .dm-ohero__headline {
    margin: 0;
    font-family: var(--dm-font-display);
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    letter-spacing: -0.02em;
    line-height: 1.12;
  }
  .dm-ohero__vehicle {
    margin: 6px 0 0;
    color: rgba(255,255,255,0.78);
    font-weight: 600;
    font-size: 1rem;
  }
  .dm-ohero__facts {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .dm-ohero__facts li {
    padding: 6px 11px;
    border-radius: 10px;
    background: rgba(255,255,255,0.09);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
  }
  .dm-ohero__track {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    counter-reset: none;
  }
  .dm-ohero__node {
    position: relative;
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 4px;
    padding-top: 6px;
    min-width: 0;
  }
  .dm-ohero__node::before {
    content: '';
    position: absolute;
    top: 19px;
    inset-inline: 0;
    height: 2px;
    background: rgba(255,255,255,0.16);
  }
  .dm-ohero__node:first-child::before { inset-inline-start: 50%; }
  .dm-ohero__node:last-child::before { inset-inline-end: 50%; }
  .dm-ohero__node.is-reached::before { background: var(--dm-amber); }
  .dm-ohero__node-dot {
    position: relative;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dm-graphite-900);
    border: 2px solid rgba(255,255,255,0.35);
    font-size: 13px;
    font-weight: 700;
    color: var(--dm-graphite-900);
  }
  .dm-ohero__node.is-reached .dm-ohero__node-dot {
    background: var(--dm-amber);
    border-color: var(--dm-amber);
  }
  .dm-ohero__node-pct { font-family: var(--dm-font-display); font-weight: 700; font-size: 0.95rem; }
  .dm-ohero__node-label { font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.3; }
  .dm-ohero__node-date { font-size: 11px; color: rgba(255,255,255,0.62); line-height: 1.3; }
  .dm-ohero__tiles {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .dm-ohero__tile {
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255,255,255,0.08);
    border: 1px solid transparent;
    min-width: 0;
  }
  .dm-ohero__tile.is-warn { border-color: rgba(219, 255, 0, 0.55); background: rgba(219, 255, 0, 0.1); }
  .dm-ohero__tile.is-done { border-color: rgba(0, 207, 162, 0.55); background: rgba(0, 207, 162, 0.14); }
  .dm-ohero__tile dt {
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.66);
  }
  .dm-ohero__tile dd {
    margin: 6px 0 0;
    font-family: var(--dm-font-display);
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .dm-ohero__tile-quiet { font-size: 1rem !important; color: rgba(255,255,255,0.8); }
  .dm-ohero__tile small { display: block; margin-top: 4px; font-size: 12px; color: rgba(255,255,255,0.72); }
  .dm-ohero__behind,
  .dm-ohero__notice {
    margin: 0;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }
  .dm-ohero__behind { background: rgba(219, 255, 0, 0.14); color: #fff; }
  .dm-ohero__notice--ok { background: rgba(0, 207, 162, 0.2); color: #fff; }
  .dm-ohero__notice--error { background: rgba(255, 99, 71, 0.22); color: #fff; }
  .dm-ohero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .dm-ohero__cta { min-height: 44px !important; padding: 0 20px !important; font-size: 0.95rem !important; }
  .dm-ohero__ghost {
    min-height: 44px !important;
    padding: 0 18px !important;
    font-size: 0.95rem !important;
    border-color: rgba(255,255,255,0.38) !important;
    color: #fff !important;
    text-decoration: none;
    font: inherit;
    font-weight: 600;
  }
  .dm-ohero__ghost:hover:not(:disabled) { border-color: #fff !important; background: rgba(255,255,255,0.08); }
  .dm-ohero__ghost:disabled { opacity: 0.6; cursor: not-allowed; }
  .dm-ohero__hint { margin: -8px 0 0; font-size: 12px; color: rgba(255,255,255,0.62); }
  .dm-ohero__settlement { scroll-margin-top: 16px; }
  .dm-ohero__muted { margin: 0; color: rgba(255,255,255,0.72); line-height: 1.5; max-width: 48ch; }
  .dm-ohero--empty {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px 24px;
  }
  .dm-ohero__empty-ring .dm-ohero__ring { width: 96px; height: 96px; }
  .dm-ohero__empty-ring .dm-ohero__ring-value { font-size: 1.6rem; }
  .dm-ohero__empty-title { margin: 6px 0 6px; font-family: var(--dm-font-display); font-size: 1.35rem; }
  .dm-ohero__empty-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .dm-ohero__skeleton { display: flex; align-items: center; gap: 24px; }
  .dm-ohero__skeleton-ring { width: 120px; height: 120px; border-radius: 50%; border: 14px solid rgba(255,255,255,0.12); }
  .dm-ohero__skeleton-lines { flex: 1; display: grid; gap: 10px; }
  .dm-ohero__skeleton-lines span { display: block; height: 14px; border-radius: 7px; background: rgba(255,255,255,0.12); }
  .dm-ohero__skeleton-lines span:first-child { height: 26px; width: 55%; }
  .dm-ohero__skeleton-lines span:nth-child(2) { width: 75%; }
  .dm-ohero__skeleton-lines span:nth-child(3) { width: 40%; }
  @media (max-width: 900px) {
    .dm-ohero--empty { grid-template-columns: auto minmax(0, 1fr); }
    .dm-ohero__empty-actions { grid-column: 1 / -1; }
  }
  @media (max-width: 640px) {
    .dm-ohero { padding: 18px 16px; border-radius: 16px; }
    .dm-ohero__main { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .dm-ohero__facts { justify-content: center; }
    .dm-ohero__track { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 8px; }
    .dm-ohero__node:nth-child(2)::before { inset-inline-end: 50%; }
    .dm-ohero__node:nth-child(3)::before { inset-inline-start: 50%; }
    .dm-ohero__tiles { grid-template-columns: 1fr; }
    .dm-ohero__actions > * { flex: 1 1 calc(50% - 10px); }
    .dm-ohero--empty { grid-template-columns: 1fr; text-align: center; justify-items: center; }
    .dm-ohero__empty-actions { width: 100%; }
    .dm-ohero__empty-actions > * { flex: 1 1 auto; }
  }
`;
