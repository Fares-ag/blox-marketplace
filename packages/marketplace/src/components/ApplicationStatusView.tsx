import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MoneyText,
  formatQar,
  getAppLocale,
  applicationMarketplacePillVariant,
  applicationStatusLabel,
} from '@drivemarket/shared';

const JOURNEY_STEPS = [
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
] as const;

const POST_JOURNEY_STATUSES = new Set([
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'lpo_issued',
  'acquisition_pending',
  'active',
  'completed',
  'hardship',
]);

function journeyProgress(status: string): number {
  if (status === 'draft') return -1;
  if (status === 'rejected' || status === 'submission_cancelled') return -1;
  if (POST_JOURNEY_STATUSES.has(status)) return JOURNEY_STEPS.length;
  const idx = JOURNEY_STEPS.indexOf(status as (typeof JOURNEY_STEPS)[number]);
  return idx >= 0 ? idx : 0;
}

/**
 * Status header, plan estimate and progress timeline. A declined application
 * shows a neutral card — customers are never shown the decision reason
 * (wave 2); a resubmission request, being an instruction, is still surfaced.
 */
export function ApplicationStatusView({
  app,
}: {
  app: {
    id: string;
    status: string;
    createdAt?: string;
    submittedAt?: string | null;
    completedAt?: string | null;
    pricingSnapshot?: Record<string, unknown> | null;
    product?: { make?: string; model?: string; slug?: string; modelYear?: number; price?: number };
    resubmissionComment?: string | null;
    settlementRequest?: { status: string; settlementAmount?: number; decidedAt?: string | null } | null;
    customerOwnershipPct?: number | null;
  };
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const dateFmt = locale === 'ar' ? 'ar-QA' : 'en-QA';
  const currentStep = journeyProgress(app.status);
  const pricing = app.pricingSnapshot ?? {};
  const monthly = Number(pricing.monthly ?? 0);
  const down = Number(pricing.down_payment ?? 0);
  const tenor = Number(pricing.tenor ?? pricing.tenure ?? 0);
  const vehiclePrice = Number(pricing.vehicle_price ?? app.product?.price ?? 0);
  const declined = app.status === 'rejected';
  const submittedLabel = app.submittedAt ?? app.createdAt;
  const journeyComplete = currentStep >= JOURNEY_STEPS.length;
  const settlementApproved = app.status === 'completed' && app.settlementRequest?.status === 'approved';
  const showPricing = !declined && !settlementApproved && (monthly > 0 || down > 0 || vehiclePrice > 0);

  return (
    <div className="dm-app-status">
      <Link className="dm-app-status__back" to="/app/applications">
        ← {t('application.title')}
      </Link>

      <header className="dm-app-status__hero">
        <div className="dm-app-status__hero-main">
          <div className="dm-app-status__hero-top">
            <span className={`dm-status-pill dm-status-pill--${applicationMarketplacePillVariant(app.status)}`}>
              {t(`application.status.${app.status}`, { defaultValue: applicationStatusLabel(app.status) })}
            </span>
            {submittedLabel && (
              <span className="dm-app-status__date">
                {t('application.submitted')}:{' '}
                {new Date(submittedLabel).toLocaleDateString(dateFmt, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {app.product && (
            <div className="dm-app-status__vehicle">
              <h1>
                {app.product.make} {app.product.model}
                {app.product.modelYear ? ` · ${app.product.modelYear}` : ''}
              </h1>
              {app.product.slug && (
                <Link className="dm-app-status__listing-link" to={`/vehicles/${app.product.slug}`}>
                  {t('application.viewListing')} →
                </Link>
              )}
            </div>
          )}
        </div>

        {showPricing && (
          <div className="dm-app-status__hero-stats" aria-label={t('application.pricingSummary')}>
            {vehiclePrice > 0 && (
              <div className="dm-app-status__stat">
                <span className="dm-app-status__stat-label">{t('detail.listPrice')}</span>
                <strong className="dm-app-status__stat-value">
                  <MoneyText>{formatQar(vehiclePrice, false, locale)}</MoneyText>
                </strong>
              </div>
            )}
            {down > 0 && (
              <div className="dm-app-status__stat">
                <span className="dm-app-status__stat-label">{t('application.downPayment')}</span>
                <strong className="dm-app-status__stat-value">
                  <MoneyText>{formatQar(down, false, locale)}</MoneyText>
                </strong>
              </div>
            )}
            {tenor > 0 && (
              <div className="dm-app-status__stat">
                <span className="dm-app-status__stat-label">{t('detail.tenure')}</span>
                <strong className="dm-app-status__stat-value">{tenor}</strong>
              </div>
            )}
            {monthly > 0 && (
              <div className="dm-app-status__stat dm-app-status__stat--accent">
                <span className="dm-app-status__stat-label">{t('detail.estMonthly')}</span>
                <strong className="dm-app-status__stat-value">
                  <MoneyText>{formatQar(monthly, true, locale)}</MoneyText>
                </strong>
              </div>
            )}
          </div>
        )}
      </header>

      {showPricing && (
        <p className="dm-app-status__note">{t('detail.estimateNote')}</p>
      )}

      {settlementApproved && (
        <section className="dm-app-status__settlement-complete" aria-live="polite">
          <p>{t('ownershipHero.settlement.approvedComplete')}</p>
          {(app.customerOwnershipPct ?? 0) >= 99.9 && (
            <p className="dm-app-status__note">
              {t('ownershipHero.milestone100')}
              {app.completedAt
                ? ` · ${new Date(app.completedAt).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </p>
          )}
        </section>
      )}

      {declined && (
        <section className="dm-app-status__declined" aria-labelledby="dm-declined-title">
          <div className="dm-app-status__declined-icon" aria-hidden>
            –
          </div>
          <div className="dm-app-status__declined-body">
            <h3 id="dm-declined-title">{t('ownershipHero.decision.declinedTitle')}</h3>
            <p>{t('ownershipHero.decision.declinedBody')}</p>
            <p className="dm-app-status__declined-support">{t('ownershipHero.decision.declinedSupport')}</p>
            <div className="dm-app-status__declined-actions">
              <Link className="dm-btn-cta dm-app-status__declined-cta" to="/help">
                {t('ownershipHero.decision.contactSupport')}
              </Link>
              <Link className="dm-btn-ghost dm-btn-ghost--on-light" to="/vehicles">
                {t('ownershipHero.decision.browseAgain')}
              </Link>
            </div>
          </div>
        </section>
      )}

      {app.status !== 'rejected' && app.status !== 'submission_cancelled' && app.status !== 'draft' && (
        <section className="dm-app-status__timeline" aria-labelledby="dm-app-timeline-title">
          <div className="dm-app-status__timeline-head">
            <h2 id="dm-app-timeline-title">{t('application.timeline')}</h2>
            <span className="dm-app-status__timeline-meta">
              {journeyComplete
                ? t('application.timelineComplete', { defaultValue: 'All steps complete' })
                : t('application.timelineStepOf', {
                    current: Math.min(currentStep + 1, JOURNEY_STEPS.length),
                    total: JOURNEY_STEPS.length,
                    defaultValue: `Step ${Math.min(currentStep + 1, JOURNEY_STEPS.length)} of ${JOURNEY_STEPS.length}`,
                  })}
            </span>
          </div>
          <ol className="dm-app-status__steps">
            {JOURNEY_STEPS.map((step, i) => {
              const done = journeyComplete || i < currentStep;
              const active = !journeyComplete && i === currentStep;
              const warn = active && step === 'resubmission_required';
              return (
                <li
                  key={step}
                  className={[
                    done ? 'is-done' : '',
                    active ? 'is-active' : '',
                    warn ? 'is-warn' : '',
                    !done && !active ? 'is-pending' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="dm-app-status__step-marker" aria-hidden>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="dm-app-status__step-label">
                    {t(`application.timelineStep.${step}`, { defaultValue: step })}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {app.resubmissionComment && !declined && (
        <div className="dm-app-status__alert" role="alert">
          <strong>{t('application.resubmissionNotice', { defaultValue: 'Action needed' })}</strong>
          <p>{app.resubmissionComment}</p>
        </div>
      )}

      <style>{`
        .dm-app-status { display: grid; gap: 20px; }
        .dm-app-status__back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 650;
          color: var(--dm-steel);
          text-decoration: none;
          width: fit-content;
        }
        .dm-app-status__back:hover { text-decoration: underline; }
        .dm-app-status__hero {
          display: grid;
          gap: 20px;
          padding: 24px 28px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--dm-graphite-900) 0%, var(--dm-graphite-800) 55%, #1a3d35 100%);
          color: #fff;
          box-shadow: var(--dm-shadow-hover);
        }
        .dm-app-status__hero-top {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          align-items: center;
        }
        .dm-app-status__date { font-size: 13px; color: rgba(255,255,255,0.72); }
        .dm-status-pill {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .dm-status-pill--approved { background: rgba(0, 207, 162, 0.2); color: #7dffd9; }
        .dm-status-pill--pending { background: rgba(255,255,255,0.14); color: #fff; }
        .dm-status-pill--rejected { background: rgba(255, 100, 100, 0.2); color: #ffb4b4; }
        .dm-app-status__vehicle h1 {
          margin: 12px 0 8px;
          font-family: var(--dm-font-display);
          font-size: clamp(1.35rem, 2.5vw, 1.85rem);
          line-height: 1.2;
          color: #fff;
        }
        .dm-app-status__listing-link {
          font-size: 14px;
          font-weight: 650;
          color: #7dffd9;
          text-decoration: none;
        }
        .dm-app-status__listing-link:hover { text-decoration: underline; }
        .dm-app-status__hero-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }
        .dm-app-status__stat {
          display: grid;
          gap: 4px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .dm-app-status__stat--accent {
          background: rgba(0, 207, 162, 0.15);
          border-color: rgba(0, 207, 162, 0.35);
        }
        .dm-app-status__stat-label {
          font-size: 11px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.65);
        }
        .dm-app-status__stat-value {
          font-family: var(--dm-font-display);
          font-size: 1.15rem;
          line-height: 1.2;
          color: #fff;
        }
        .dm-app-status__note {
          margin: -8px 0 0;
          font-size: 13px;
          color: var(--dm-slate-600);
          font-style: italic;
        }
        .dm-app-status__declined {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 20px 22px;
          border-radius: 14px;
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-inline-start: 4px solid var(--dm-slate-400);
        }
        .dm-app-status__declined-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--dm-canvas);
          color: var(--dm-slate-600);
          font-weight: 800;
          font-size: 1.2rem;
        }
        .dm-app-status__declined-body { display: grid; gap: 8px; min-width: 0; }
        .dm-app-status__declined h3 { margin: 0; font-family: var(--dm-font-display); font-size: 1.15rem; line-height: 1.3; }
        .dm-app-status__declined p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--dm-slate-600); max-width: 60ch; }
        .dm-app-status__declined-support { color: var(--dm-ink) !important; }
        .dm-app-status__declined-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
        .dm-app-status__declined-cta { min-height: 42px !important; padding: 0 18px !important; font-size: 0.9rem !important; }
        .dm-app-status__timeline {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 16px;
          padding: 22px 24px;
          box-shadow: var(--dm-shadow-rest);
        }
        .dm-app-status__timeline-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .dm-app-status__timeline h2 {
          margin: 0;
          font-family: var(--dm-font-display);
          font-size: 1.05rem;
        }
        .dm-app-status__timeline-meta {
          font-size: 13px;
          font-weight: 650;
          color: var(--dm-slate-600);
        }
        .dm-app-status__steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        .dm-app-status__steps li {
          display: grid;
          gap: 10px;
          justify-items: center;
          text-align: center;
          padding: 14px 10px;
          border-radius: 12px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
          position: relative;
          min-height: 96px;
        }
        .dm-app-status__steps li.is-pending {
          opacity: 0.55;
        }
        .dm-app-status__steps li.is-active {
          border-color: var(--dm-steel);
          background: var(--dm-steel-soft);
          box-shadow: 0 0 0 1px rgba(0, 100, 80, 0.08);
        }
        .dm-app-status__steps li.is-warn {
          border-color: var(--dm-warning, #c47a00);
          background: var(--dm-warning-soft, #fff4e0);
        }
        .dm-app-status__steps li.is-done {
          border-color: rgba(6, 118, 71, 0.35);
          background: rgba(6, 118, 71, 0.06);
        }
        .dm-app-status__step-marker {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 800;
          background: var(--dm-slate-200);
          color: var(--dm-slate-600);
        }
        .dm-app-status__steps li.is-active .dm-app-status__step-marker,
        .dm-app-status__steps li.is-done .dm-app-status__step-marker {
          background: var(--dm-steel);
          color: #fff;
        }
        .dm-app-status__steps li.is-warn .dm-app-status__step-marker {
          background: var(--dm-warning, #c47a00);
          color: #fff;
        }
        .dm-app-status__step-label {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 600;
          color: var(--dm-slate-600);
        }
        .dm-app-status__steps li.is-active .dm-app-status__step-label,
        .dm-app-status__steps li.is-done .dm-app-status__step-label {
          color: var(--dm-ink);
        }
        .dm-app-status__alert {
          padding: 14px 18px;
          border-radius: 12px;
          background: var(--dm-warning-soft);
          border: 1px solid rgba(196, 122, 0, 0.25);
          display: grid;
          gap: 6px;
        }
        .dm-app-status__alert strong {
          font-size: 14px;
          color: var(--dm-warning, #7a4b00);
        }
        .dm-app-status__alert p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: var(--dm-ink);
        }
        @media (max-width: 1100px) {
          .dm-app-status__steps {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .dm-app-status__hero { padding: 18px 20px; }
          .dm-app-status__steps {
            grid-template-columns: 1fr;
          }
          .dm-app-status__steps li {
            grid-template-columns: 32px 1fr;
            grid-template-rows: auto;
            justify-items: start;
            text-align: start;
            align-items: center;
            min-height: 0;
          }
          .dm-app-status__declined { flex-direction: column; }
          .dm-app-status__declined-actions > * { flex: 1 1 auto; text-align: center; }
        }
      `}</style>
    </div>
  );
}
