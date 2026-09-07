import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ApplicationStatus } from '@drivemarket/shared';
import {
  MoneyText,
  formatQar,
  getAppLocale,
  applicationMarketplacePillVariant,
  applicationStatusLabel,
} from '@drivemarket/shared';

const TIMELINE_STEPS: ApplicationStatus[] = [
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'active',
  'completed',
];

function statusIndex(status: string): number {
  if (status === 'rejected' || status === 'submission_cancelled') return -1;
  const idx = TIMELINE_STEPS.indexOf(status as ApplicationStatus);
  return idx >= 0 ? idx : 0;
}

export function ApplicationStatusView({
  app,
}: {
  app: {
    id: string;
    status: string;
    createdAt?: string;
    pricingSnapshot?: Record<string, unknown> | null;
    product?: { make?: string; model?: string; slug?: string; modelYear?: number };
    rejectionReason?: string | null;
    resubmissionComment?: string | null;
  };
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const currentIdx = statusIndex(app.status);
  const pricing = app.pricingSnapshot ?? {};
  const monthly = Number(pricing.monthly ?? 0);
  const down = Number(pricing.down_payment ?? 0);
  const tenor = Number(pricing.tenor ?? pricing.tenor ?? 0);

  return (
    <div className="dm-app-status">
      <div className="dm-app-status__header">
        <span className={`dm-status-pill dm-status-pill--${applicationMarketplacePillVariant(app.status)}`}>
          {t(`application.status.${app.status}`, { defaultValue: applicationStatusLabel(app.status) })}
        </span>
        {app.createdAt && (
          <span className="dm-app-status__date">
            {t('application.submitted')}: {new Date(app.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-QA')}
          </span>
        )}
      </div>

      {app.product && (
        <div className="dm-app-status__vehicle">
          <h2>
            {app.product.make} {app.product.model}
            {app.product.modelYear ? ` · ${app.product.modelYear}` : ''}
          </h2>
          {app.product.slug && (
            <Link to={`/vehicles/${app.product.slug}`}>{t('application.viewListing')}</Link>
          )}
        </div>
      )}

      {(monthly > 0 || down > 0) && (
        <div className="dm-app-status__pricing">
          <h3>{t('application.pricingSummary')}</h3>
          <dl>
            {down > 0 && (
              <>
                <dt>{t('application.downPayment')}</dt>
                <dd><MoneyText>{formatQar(down, false, locale)}</MoneyText></dd>
              </>
            )}
            {tenor > 0 && (
              <>
                <dt>{t('detail.tenure')}</dt>
                <dd>{tenor}</dd>
              </>
            )}
            {monthly > 0 && (
              <>
                <dt>{t('detail.estMonthly')}</dt>
                <dd><MoneyText>{formatQar(monthly, true, locale)}</MoneyText></dd>
              </>
            )}
          </dl>
          <p className="dm-app-status__note">{t('detail.estimateNote')}</p>
        </div>
      )}

      {app.status !== 'rejected' && app.status !== 'submission_cancelled' && (
        <div className="dm-app-status__timeline">
          <h3>{t('application.timeline')}</h3>
          <ol>
            {TIMELINE_STEPS.slice(0, 5).map((step, i) => {
              const done = currentIdx >= i;
              const active = currentIdx === i;
              return (
                <li key={step} className={done ? 'is-done' : active ? 'is-active' : ''}>
                  {t(`application.timelineStep.${step}`, { defaultValue: step })}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {app.rejectionReason && (
        <p className="dm-app-status__alert">{app.rejectionReason}</p>
      )}
      {app.resubmissionComment && (
        <p className="dm-app-status__alert">{app.resubmissionComment}</p>
      )}

      <style>{`
        .dm-app-status { display: grid; gap: 24px; }
        .dm-app-status__header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .dm-app-status__date { font-size: 14px; color: var(--dm-slate-600); }
        .dm-status-pill {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .dm-status-pill--approved { background: var(--dm-success-soft); color: var(--dm-success); }
        .dm-status-pill--pending { background: var(--dm-steel-soft); color: var(--dm-ink); }
        .dm-status-pill--rejected { background: var(--dm-danger-soft); color: var(--dm-danger); }
        .dm-app-status__vehicle h2 { margin: 0 0 8px; font-family: var(--dm-font-display); font-size: 1.25rem; }
        .dm-app-status__pricing, .dm-app-status__timeline {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 12px;
          padding: 20px;
        }
        .dm-app-status__pricing h3, .dm-app-status__timeline h3 { margin: 0 0 12px; font-size: 1rem; }
        .dm-app-status__pricing dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; }
        .dm-app-status__pricing dt { color: var(--dm-slate-600); font-size: 14px; }
        .dm-app-status__pricing dd { margin: 0; font-weight: 600; }
        .dm-app-status__note { margin: 12px 0 0; font-size: 12px; color: var(--dm-slate-600); }
        .dm-app-status__timeline ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .dm-app-status__timeline li {
          padding: 10px 12px;
          padding-inline-start: 28px;
          border-radius: 8px;
          font-size: 14px;
          position: relative;
          background: var(--dm-canvas);
          color: var(--dm-slate-600);
        }
        .dm-app-status__timeline li::before {
          content: '';
          position: absolute;
          inset-inline-start: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--dm-slate-400);
        }
        .dm-app-status__timeline li.is-done { color: var(--dm-ink); font-weight: 500; }
        .dm-app-status__timeline li.is-done::before { background: var(--dm-steel); }
        .dm-app-status__timeline li.is-active { background: var(--dm-steel-soft); color: var(--dm-ink); font-weight: 600; }
        .dm-app-status__timeline li.is-active::before { background: var(--dm-steel); }
        .dm-app-status__alert {
          padding: 12px 16px;
          border-radius: 8px;
          background: var(--dm-warning-soft);
          color: var(--dm-warning);
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
