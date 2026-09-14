import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  calculateOwnershipTimeline,
  filterKeyMilestones,
  formatQar,
  getAppLocale,
  type OwnershipMilestone,
  type OwnershipMilestoneKind,
  type OwnershipScheduleInput,
} from '@drivemarket/shared';

/** Live schedule row; the API sends `paid_amount: null` before any payment lands. */
export type OwnershipScheduleRow = Omit<OwnershipScheduleInput, 'paidAmount'> & {
  id: string;
  paidAmount?: number | string | null;
};

type Props = {
  pricingSnapshot?: Record<string, unknown> | null;
  paymentSchedules?: OwnershipScheduleRow[];
  compact?: boolean;
  showTimeline?: boolean;
  onRecoveryContribute?: () => void;
  onRecoveryViewTimeline?: () => void;
};

const CUSTOMER_COLOR = '#E2B13C';
const BLOX_COLOR = '#00CFA2';

function milestoneBadgeKey(kind: OwnershipMilestoneKind): string {
  const map: Record<OwnershipMilestoneKind, string> = {
    first_payment: 'ownership.milestoneFirstPayment',
    quarter: 'ownership.milestone25',
    halfway: 'ownership.milestone50',
    three_quarters: 'ownership.milestone75',
    almost_there: 'ownership.milestone95',
    full_owner: 'ownership.milestone100',
  };
  return map[kind] ?? kind;
}

function milestoneLabel(
  m: OwnershipMilestone,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (m.labelKey === 'ownership.paymentNumber') {
    return t('ownership.paymentNumber', { n: m.sequence });
  }
  return t(m.labelKey);
}

function statusLabel(
  status: OwnershipMilestone['paymentStatus'],
  t: (key: string) => string,
): string {
  if (status === 'paid') return t('ownership.paid');
  if (status === 'missed') return t('ownership.catchUpShare');
  return t('ownership.scheduled');
}

function MilestoneIcon({ milestone }: { milestone: OwnershipMilestone }) {
  if (milestone.milestone === 'full_owner' || milestone.milestone === 'almost_there') {
    return <span aria-hidden>🏆</span>;
  }
  if (milestone.milestone === 'halfway' || milestone.milestone === 'quarter') {
    return <span aria-hidden>★</span>;
  }
  if (milestone.paymentStatus === 'paid') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5l2 1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function OwnershipProgress({
  pricingSnapshot,
  paymentSchedules,
  compact = false,
  showTimeline = false,
  onRecoveryContribute,
  onRecoveryViewTimeline,
}: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const dateFmt = locale === 'ar' ? 'ar-QA' : 'en-QA';

  const timeline = useMemo(
    () =>
      calculateOwnershipTimeline(
        pricingSnapshot,
        paymentSchedules?.map((row) => ({ ...row, paidAmount: row.paidAmount ?? undefined })),
      ),
    [paymentSchedules, pricingSnapshot],
  );

  const keyMilestones = useMemo(
    () => filterKeyMilestones(timeline.milestones),
    [timeline.milestones],
  );

  const customerPct = timeline.vehiclePrice > 0
    ? Math.round((timeline.currentOwnershipAmount / timeline.vehiclePrice) * 10000) / 100
    : timeline.currentOwnership;
  const bloxPct = Math.max(0, Math.round((100 - customerPct) * 100) / 100);

  const fullyYoursDate =
    timeline.estimatedCompletionDate &&
    new Date(timeline.estimatedCompletionDate).toLocaleDateString(dateFmt, {
      month: 'short',
      year: 'numeric',
    });

  const fmtCurrency = (amount: number) => formatQar(amount, false, locale);

  return (
    <div className={`dm-ownership${compact ? ' dm-ownership--compact' : ''}`}>
      {!compact && (
        <header className="dm-ownership__journey-head">
          <div>
            <h4 className="dm-ownership__journey-title">{t('ownership.journeyTitle')}</h4>
            <p className="dm-ownership__journey-sub">{t('ownership.journeySubtitle')}</p>
          </div>
          <div className="dm-ownership__journey-pct">
            <strong>{timeline.currentOwnership.toFixed(1)}%</strong>
            <span>{t('ownership.currentOwnership')}</span>
          </div>
        </header>
      )}

      {compact && (
        <div className="dm-ownership__head">
          <span className="dm-ownership__label">{t('ownership.yourStake')}</span>
          <strong className="dm-ownership__pct">{timeline.currentOwnership.toFixed(1)}%</strong>
        </div>
      )}

      {/* Segmented asset distribution bar (badrGo model) */}
      <div className="dm-ownership__distribution">
        {!compact && (
          <span className="dm-ownership__distribution-label">{t('ownership.assetDistribution')}</span>
        )}
        <div
          className="dm-ownership__segmented"
          role="img"
          aria-label={`${t('ownership.ownedByYou')} ${customerPct}%, ${t('ownership.ownedByBlox')} ${bloxPct}%`}
        >
          {customerPct > 0 && (
            <span
              className="dm-ownership__segment dm-ownership__segment--customer"
              style={{ width: `${customerPct}%` }}
            />
          )}
          {bloxPct > 0 && (
            <span
              className="dm-ownership__segment dm-ownership__segment--blox"
              style={{ width: `${bloxPct}%` }}
            />
          )}
        </div>
        <div className="dm-ownership__segment-labels">
          <span className="dm-ownership__segment-label dm-ownership__segment-label--customer">
            {customerPct.toFixed(1)}% {t('ownership.ownedByYou')}
          </span>
          <span className="dm-ownership__segment-label dm-ownership__segment-label--blox">
            {bloxPct.toFixed(1)}% {t('ownership.ownedByBlox')}
          </span>
        </div>
      </div>

      {/* Progress bar with amount range */}
      <div className="dm-ownership__progress-wrap">
        <div className="dm-ownership__progress-labels">
          <span>0%</span>
          <span>100%</span>
        </div>
        <div
          className="dm-ownership__bar"
          role="progressbar"
          aria-valuenow={timeline.progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('ownership.yourStake')}
        >
          <span
            className="dm-ownership__fill"
            style={{ width: `${Math.min(100, timeline.progressPercentage)}%` }}
          />
        </div>
        {!compact && timeline.vehiclePrice > 0 && (
          <div className="dm-ownership__progress-range">
            <span>{fmtCurrency(timeline.downPayment)}</span>
            <span>{fmtCurrency(timeline.vehiclePrice)}</span>
          </div>
        )}
      </div>

      {!compact && timeline.totalPayments > 0 && (
        <div className="dm-ownership__stats">
          <div className="dm-ownership__stat">
            <strong>{timeline.completedPayments}</strong>
            <span>{t('ownership.paymentsCompleted')}</span>
          </div>
          <div className="dm-ownership__stat">
            <strong>{timeline.totalPayments - timeline.completedPayments}</strong>
            <span>{t('ownership.paymentsRemaining')}</span>
          </div>
          {fullyYoursDate && (
            <div className="dm-ownership__stat">
              <strong>{fullyYoursDate}</strong>
              <span>{t('ownership.estCompletion')}</span>
            </div>
          )}
        </div>
      )}

      {fullyYoursDate && compact && (
        <p className="dm-ownership__trajectory">
          {t('ownership.fullyYoursBy', { date: fullyYoursDate })}
          {timeline.projected && ' *'}
        </p>
      )}

      {timeline.projected && !compact && (
        <p className="dm-ownership__projected">{t('ownership.projectedNote')}</p>
      )}

      {timeline.hasOverdue && (
        <div className="dm-ownership__recovery">
          <p className="dm-ownership__behind">{t('ownership.behind')}</p>
          <div className="dm-ownership__recovery-actions">
            {onRecoveryContribute && (
              <button type="button" className="dm-ownership__recovery-btn" onClick={onRecoveryContribute}>
                {t('ownership.recoveryContribute')}
              </button>
            )}
            {onRecoveryViewTimeline && (
              <button type="button" className="dm-ownership__recovery-btn dm-ownership__recovery-btn--ghost" onClick={onRecoveryViewTimeline}>
                {t('ownership.recoveryViewTimeline')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Key milestones — card grid on detail, compact list on dashboard */}
      {showTimeline && keyMilestones.length > 0 && (
        <section className="dm-ownership__stepper">
          {!compact && <h5 className="dm-ownership__stepper-title">{t('ownership.timelineTitle')}</h5>}
          <ol className={`dm-ownership__steps${compact ? ' dm-ownership__steps--compact' : ''}`}>
            {keyMilestones.map((milestone) => {
              const paid = milestone.paymentStatus === 'paid';
              const missed = milestone.paymentStatus === 'missed';
              return (
                <li
                  key={`${milestone.sequence}-${milestone.date}`}
                  className={`dm-ownership__step${paid ? ' is-paid' : missed ? ' is-missed' : ' is-upcoming'}`}
                >
                  <div className="dm-ownership__step-icon">
                    <MilestoneIcon milestone={milestone} />
                  </div>
                  <div className="dm-ownership__step-body">
                    <div className="dm-ownership__step-head">
                      <strong>{milestoneLabel(milestone, t)}</strong>
                      {milestone.milestone && (
                        <span className="dm-ownership__step-badge">
                          {t(milestoneBadgeKey(milestone.milestone))}
                        </span>
                      )}
                    </div>
                    <dl className="dm-ownership__step-stats">
                      <div>
                        <dt>{t('ownership.yourStake')}</dt>
                        <dd>{milestone.ownershipPercentage.toFixed(1)}%</dd>
                      </div>
                      <div>
                        <dt>{t('ownership.stakeValue', { defaultValue: 'Stake value' })}</dt>
                        <dd>{fmtCurrency(milestone.ownershipAmount)}</dd>
                      </div>
                      <div>
                        <dt>{t('ownership.contributionDue')}</dt>
                        <dd>{new Date(milestone.date).toLocaleDateString(dateFmt)}</dd>
                      </div>
                    </dl>
                    <p className="dm-ownership__step-meta">
                      {t('ownership.paymentOf', {
                        n: milestone.sequence,
                        total: timeline.totalPayments,
                      })}
                      {' · '}
                      {statusLabel(milestone.paymentStatus, t)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Full payment schedule with customer / Blox share columns */}
      {showTimeline && timeline.milestones.length > 0 && (
        <div className="dm-ownership__schedule">
          <h5 className="dm-ownership__schedule-title">{t('ownership.scheduleTitle', { defaultValue: 'Full contribution schedule' })}</h5>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('ownership.contributionDue')}</th>
                <th>{t('ownership.customerShare')}</th>
                <th>{t('ownership.bloxShare')}</th>
                <th>{t('ownership.status')}</th>
              </tr>
            </thead>
            <tbody>
              {timeline.milestones.map((m) => (
                <tr
                  key={`sched-${m.sequence}`}
                  className={
                    m.paymentStatus === 'paid'
                      ? 'is-paid'
                      : m.paymentStatus === 'missed'
                        ? 'is-missed'
                        : ''
                  }
                >
                  <td>{m.sequence}</td>
                  <td>{new Date(m.date).toLocaleDateString(dateFmt)}</td>
                  <td>
                    <span className="dm-ownership__share dm-ownership__share--customer">
                      {fmtCurrency(m.customerShare)}
                    </span>
                  </td>
                  <td>
                    <span className="dm-ownership__share dm-ownership__share--blox">
                      {fmtCurrency(m.bloxShare)}
                    </span>
                  </td>
                  <td>{statusLabel(m.paymentStatus, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compact && (
        <p className="dm-ownership__support">{t('ownership.contributionGrows')}</p>
      )}

      <style>{`
        .dm-ownership {
          display: grid;
          gap: 20px;
          padding: 22px 24px;
          border-radius: 14px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          box-shadow: var(--dm-shadow-rest);
          width: 100%;
        }
        .dm-ownership--compact {
          padding: 12px 14px;
          gap: 10px;
          background: linear-gradient(180deg, var(--dm-steel-soft), var(--dm-surface));
          box-shadow: none;
        }
        .dm-ownership__journey-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .dm-ownership__journey-title {
          margin: 0 0 4px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-ownership__journey-sub {
          margin: 0;
          font-size: 13px;
          color: var(--dm-slate-600);
          line-height: 1.4;
        }
        .dm-ownership__journey-pct {
          text-align: end;
          display: grid;
          gap: 2px;
        }
        .dm-ownership__journey-pct strong {
          font-family: var(--dm-font-display);
          font-size: 1.75rem;
          line-height: 1;
          color: var(--dm-ink);
        }
        .dm-ownership__journey-pct span {
          font-size: 11px;
          color: var(--dm-slate-600);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .dm-ownership__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .dm-ownership__label {
          font-size: 13px;
          font-weight: 600;
          color: var(--dm-slate-600);
        }
        .dm-ownership__pct {
          font-family: var(--dm-font-display);
          font-size: 1.35rem;
          color: var(--dm-ink);
          line-height: 1;
        }
        .dm-ownership--compact .dm-ownership__pct { font-size: 1.15rem; }
        .dm-ownership__distribution { display: grid; gap: 6px; }
        .dm-ownership__distribution-label {
          font-size: 12px;
          font-weight: 650;
          color: var(--dm-slate-600);
        }
        .dm-ownership__segmented {
          display: flex;
          height: ${compact ? '8px' : '24px'};
          border-radius: ${compact ? '999px' : '6px'};
          overflow: hidden;
          background: var(--dm-slate-200);
        }
        .dm-ownership__segment { height: 100%; min-width: 2px; transition: width 400ms ease; }
        .dm-ownership__segment--customer { background: ${CUSTOMER_COLOR}; }
        .dm-ownership__segment--blox { background: ${BLOX_COLOR}; }
        .dm-ownership__segment-labels {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          font-size: ${compact ? '10px' : '12px'};
          font-weight: 600;
        }
        .dm-ownership__segment-label--customer { color: ${CUSTOMER_COLOR}; }
        .dm-ownership__segment-label--blox { color: ${BLOX_COLOR}; }
        .dm-ownership__progress-wrap { display: grid; gap: 4px; }
        .dm-ownership__progress-labels,
        .dm-ownership__progress-range {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--dm-slate-600);
        }
        .dm-ownership__bar {
          position: relative;
          height: 12px;
          border-radius: 999px;
          background: var(--dm-slate-200);
          overflow: hidden;
        }
        .dm-ownership__fill {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #2E7D32;
          transition: width 400ms ease;
        }
        .dm-ownership__stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .dm-ownership__stat {
          display: grid;
          gap: 2px;
        }
        .dm-ownership__stat strong {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-ownership__stat span {
          font-size: 11px;
          color: var(--dm-slate-600);
        }
        .dm-ownership__trajectory {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--dm-ink);
        }
        .dm-ownership__projected {
          margin: 0;
          font-size: 12px;
          color: var(--dm-slate-600);
          font-style: italic;
        }
        .dm-ownership__behind {
          margin: 0;
          padding: 0;
          background: none;
          color: var(--dm-warning);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.4;
        }
        .dm-ownership__recovery {
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--dm-warning-soft);
          display: grid;
          gap: 10px;
        }
        .dm-ownership__recovery-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .dm-ownership__recovery-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          font: inherit;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          background: var(--dm-steel);
          color: #fff;
        }
        .dm-ownership__recovery-btn--ghost {
          background: transparent;
          color: var(--dm-ink);
          border: 1px solid var(--dm-slate-300);
        }
        .dm-ownership__stepper-title {
          margin: 0 0 14px;
          font-family: var(--dm-font-display);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-ownership__steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
          gap: 14px;
        }
        .dm-ownership__steps--compact {
          grid-template-columns: 1fr;
          gap: 0;
        }
        .dm-ownership__step {
          display: grid;
          gap: 14px;
          padding: 18px;
          border-radius: 14px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
          min-width: 0;
        }
        .dm-ownership__step.is-paid {
          border-color: rgba(46, 125, 50, 0.35);
          background: rgba(46, 125, 50, 0.05);
        }
        .dm-ownership__step.is-missed {
          border-color: rgba(196, 122, 0, 0.35);
          background: var(--dm-warning-soft);
        }
        .dm-ownership__steps--compact .dm-ownership__step {
          grid-template-columns: 40px 1fr;
          gap: 12px;
          padding: 12px 0;
          border-radius: 0;
          background: transparent;
          border: none;
          border-inline-start: 2px solid var(--dm-slate-200);
          margin-inline-start: 19px;
          padding-inline-start: 20px;
          position: relative;
        }
        .dm-ownership__steps--compact .dm-ownership__step:last-child {
          border-inline-start-color: transparent;
        }
        .dm-ownership__step-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--dm-slate-200);
          color: var(--dm-slate-600);
          flex-shrink: 0;
        }
        .dm-ownership__steps--compact .dm-ownership__step-icon {
          position: absolute;
          inset-inline-start: -21px;
          top: 12px;
          width: 40px;
          height: 40px;
        }
        .dm-ownership__step.is-paid .dm-ownership__step-icon {
          background: #2E7D32;
          color: #fff;
        }
        .dm-ownership__step.is-missed .dm-ownership__step-icon {
          background: var(--dm-warning-soft);
          color: var(--dm-warning);
        }
        .dm-ownership__step-body { display: grid; gap: 10px; min-width: 0; }
        .dm-ownership__step-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dm-ownership__step-head strong {
          font-size: 1rem;
          line-height: 1.3;
          color: var(--dm-ink);
        }
        .dm-ownership__step-badge {
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: var(--dm-steel-soft);
          color: var(--dm-ink);
          flex-shrink: 0;
        }
        .dm-ownership__step.is-paid .dm-ownership__step-badge {
          background: rgba(46, 125, 50, 0.15);
          color: #2E7D32;
        }
        .dm-ownership__step-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }
        .dm-ownership__step-stats div {
          display: grid;
          gap: 3px;
          padding: 10px;
          border-radius: 10px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          min-width: 0;
        }
        .dm-ownership__step-stats dt {
          font-size: 10px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--dm-slate-600);
        }
        .dm-ownership__step-stats dd {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--dm-ink);
          overflow-wrap: anywhere;
        }
        .dm-ownership__step-meta {
          margin: 0;
          font-size: 12px;
          color: var(--dm-slate-600);
          line-height: 1.45;
        }
        .dm-ownership__schedule {
          overflow-x: auto;
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px solid var(--dm-slate-200);
        }
        .dm-ownership__schedule-title {
          margin: 0 0 12px;
          font-family: var(--dm-font-display);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-ownership__schedule table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .dm-ownership__schedule th,
        .dm-ownership__schedule td {
          padding: 8px 10px;
          text-align: start;
          border-bottom: 1px solid var(--dm-slate-200);
        }
        .dm-ownership__schedule th {
          font-size: 11px;
          font-weight: 700;
          color: var(--dm-slate-600);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .dm-ownership__schedule tr.is-paid { background: rgba(0, 207, 162, 0.06); }
        .dm-ownership__schedule tr.is-missed { background: var(--dm-warning-soft); }
        .dm-ownership__share {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 650;
          font-size: 12px;
        }
        .dm-ownership__share--customer {
          background: #FEF3C7;
          color: #F59E0B;
        }
        .dm-ownership__share--blox {
          background: #D1FAE5;
          color: #10B981;
        }
        .dm-ownership__support {
          margin: 0;
          font-size: 12px;
          color: var(--dm-slate-600);
          line-height: 1.4;
        }
        @media (max-width: 720px) {
          .dm-ownership__steps { grid-template-columns: 1fr; }
          .dm-ownership__step-stats { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .dm-ownership { padding: 16px; }
          .dm-ownership__journey-pct strong { font-size: 1.4rem; }
          .dm-ownership__schedule th:nth-child(2),
          .dm-ownership__schedule td:nth-child(2) { display: none; }
        }
      `}</style>
    </div>
  );
}
