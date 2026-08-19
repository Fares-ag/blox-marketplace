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

export type OwnershipScheduleRow = OwnershipScheduleInput & { id: string };

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
    () => calculateOwnershipTimeline(pricingSnapshot, paymentSchedules),
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

      {/* Vertical milestone stepper */}
      {showTimeline && keyMilestones.length > 0 && (
        <section className="dm-ownership__stepper">
          {!compact && <h5 className="dm-ownership__stepper-title">{t('ownership.timelineTitle')}</h5>}
          <ol className="dm-ownership__steps">
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
                    <div className="dm-ownership__step-chips">
                      <span className="dm-ownership__chip dm-ownership__chip--pct">
                        {milestone.ownershipPercentage.toFixed(1)}% {t('ownership.yourStake').toLowerCase()}
                      </span>
                      <span className="dm-ownership__chip dm-ownership__chip--amt">
                        {fmtCurrency(milestone.ownershipAmount)}
                      </span>
                      <span className="dm-ownership__chip dm-ownership__chip--date">
                        {new Date(milestone.date).toLocaleDateString(dateFmt)}
                      </span>
                    </div>
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
          gap: 14px;
          padding: 16px;
          border-radius: 12px;
          background: linear-gradient(180deg, var(--dm-steel-soft), var(--dm-surface));
          border: 1px solid var(--dm-slate-200);
        }
        .dm-ownership--compact {
          padding: 12px 14px;
          gap: 10px;
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
          margin: 0 0 10px;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-ownership__steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0;
        }
        .dm-ownership__step {
          display: grid;
          grid-template-columns: 40px 1fr;
          gap: 12px;
          padding: 12px 0;
          border-inline-start: 2px solid var(--dm-slate-200);
          margin-inline-start: 19px;
          padding-inline-start: 20px;
          position: relative;
        }
        .dm-ownership__step:last-child { border-inline-start-color: transparent; }
        .dm-ownership__step-icon {
          position: absolute;
          inset-inline-start: -21px;
          top: 12px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--dm-slate-200);
          color: var(--dm-slate-600);
        }
        .dm-ownership__step.is-paid .dm-ownership__step-icon {
          background: #2E7D32;
          color: #fff;
        }
        .dm-ownership__step.is-missed .dm-ownership__step-icon {
          background: var(--dm-warning-soft);
          color: var(--dm-warning);
        }
        .dm-ownership__step-body { display: grid; gap: 6px; min-width: 0; }
        .dm-ownership__step-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dm-ownership__step-head strong {
          font-size: 14px;
          color: var(--dm-ink);
        }
        .dm-ownership__step-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: var(--dm-steel-soft);
          color: var(--dm-ink);
        }
        .dm-ownership__step.is-paid .dm-ownership__step-badge {
          background: rgba(46, 125, 50, 0.15);
          color: #2E7D32;
        }
        .dm-ownership__step-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .dm-ownership__chip {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
        }
        .dm-ownership__chip--pct {
          background: rgba(46, 125, 50, 0.12);
          color: #1B5E20;
        }
        .dm-ownership__chip--amt {
          background: rgba(14, 25, 9, 0.06);
          color: var(--dm-ink);
        }
        .dm-ownership__chip--date {
          background: rgba(0, 0, 0, 0.04);
          color: var(--dm-slate-600);
        }
        .dm-ownership__step-meta {
          margin: 0;
          font-size: 12px;
          color: var(--dm-slate-600);
        }
        .dm-ownership__schedule {
          overflow-x: auto;
          margin-top: 4px;
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
        @media (max-width: 480px) {
          .dm-ownership__journey-pct strong { font-size: 1.4rem; }
          .dm-ownership__schedule th:nth-child(2),
          .dm-ownership__schedule td:nth-child(2) { display: none; }
        }
      `}</style>
    </div>
  );
}
