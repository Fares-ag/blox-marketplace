import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoneyText, formatQar, getAppLocale } from '@drivemarket/shared';

/** Normalize to E.164-ish digits for tel/WhatsApp (default Qatar 974). */
export function toDialDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('974')) return digits;
  if (digits.startsWith('0') && digits.length === 8) return `974${digits.slice(1)}`;
  if (digits.length === 8) return `974${digits}`;
  return digits;
}

type Props = {
  price: number;
  financeEligible: boolean;
  availability?: 'available' | 'pending_financing';
  companyCode?: string | null;
  companyName?: string | null;
  contactPhone?: string | null;
  listingTitle?: string;
  monthlyEstimate?: number | null;
  onApply: () => void;
  children?: ReactNode;
};

export function ListingCtaPanel({
  price,
  financeEligible,
  availability = 'available',
  companyCode,
  companyName,
  contactPhone,
  listingTitle,
  monthlyEstimate,
  onApply,
  children,
}: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const forSale = availability === 'available';
  const dial = contactPhone ? toDialDigits(contactPhone) : '';
  const telHref = dial ? `tel:+${dial}` : null;
  const waText = encodeURIComponent(
    listingTitle
      ? t('detail.whatsappPrefill', { listing: listingTitle })
      : t('detail.whatsappPrefillGeneric'),
  );
  const waHref = dial ? `https://api.whatsapp.com/send?phone=${dial}&text=${waText}` : null;

  return (
    <aside className="dm-cta-panel">
      <div className="dm-cta-panel__price">
        <MoneyText>{formatQar(price, false, locale)}</MoneyText>
      </div>

      <div className={`dm-cta-panel__badge ${forSale ? 'is-sale' : 'is-pending'}`}>
        <span className="dm-cta-panel__badge-dot" aria-hidden />
        {forSale ? t('detail.forSale') : t('detail.pendingFinancing')}
      </div>

      {monthlyEstimate != null && monthlyEstimate > 0 && (
        <p className="dm-cta-panel__monthly">
          {t('detail.estMonthly')}: <MoneyText>{formatQar(Math.round(monthlyEstimate), true, locale)}</MoneyText>
        </p>
      )}

      <div className="dm-cta-panel__actions">
        {financeEligible ? (
          <button type="button" className="dm-cta-panel__primary" onClick={onApply}>
            {t('detail.apply')}
          </button>
        ) : (
          <p className="dm-cta-panel__warn">{t('detail.notFinanceEligible')}</p>
        )}

        {telHref && (
          <a href={telHref} className="dm-cta-panel__call">
            <span className="dm-cta-panel__icon" aria-hidden>
              ☎
            </span>
            {t('detail.callNow')}
          </a>
        )}

        {waHref && (
          <a href={waHref} className="dm-cta-panel__whatsapp" target="_blank" rel="noopener noreferrer">
            <span className="dm-cta-panel__icon" aria-hidden>
              WA
            </span>
            {t('detail.whatsapp')}
          </a>
        )}

        {companyCode && (
          <Link to={`/dealers/${companyCode}`} className="dm-cta-panel__secondary">
            {t('detail.viewShowroom')}
            {companyName ? ` · ${companyName}` : ''}
          </Link>
        )}
      </div>

      {children && <div className="dm-cta-panel__calc">{children}</div>}

      <Link to="/help" className="dm-cta-panel__help">
        {t('detail.howFinancingWorks')}
      </Link>

      <style>{`
        .dm-cta-panel {
          background: var(--dm-graphite-900);
          color: #fff;
          border-radius: 16px;
          padding: 28px 24px;
          align-self: start;
          position: sticky;
          top: 24px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .dm-cta-panel__price {
          text-align: center;
          font-size: clamp(1.75rem, 2.5vw, 2.25rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }
        .dm-cta-panel__price .dm-money { color: #fff; }
        .dm-cta-panel__badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 auto 18px;
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid rgba(230, 161, 0, 0.85);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 600;
          width: fit-content;
          max-width: 100%;
          align-self: center;
        }
        .dm-cta-panel__badge-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--dm-amber);
          display: inline-block;
          flex-shrink: 0;
        }
        .dm-cta-panel__badge.is-pending {
          border-color: rgba(255,255,255,0.35);
        }
        .dm-cta-panel__badge.is-pending .dm-cta-panel__badge-dot {
          background: var(--dm-steel);
        }
        .dm-cta-panel__monthly {
          text-align: center;
          margin: 0 0 16px;
          color: rgba(255,255,255,0.78);
          font-size: 0.95rem;
        }
        .dm-cta-panel__monthly .dm-money { color: #fff; font-weight: 600; }
        .dm-cta-panel__actions {
          display: grid;
          gap: 12px;
          width: 100%;
        }
        .dm-cta-panel__primary,
        .dm-cta-panel__call,
        .dm-cta-panel__whatsapp,
        .dm-cta-panel__secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 52px;
          border-radius: 12px;
          font: inherit;
          font-weight: 700;
          font-size: 1.05rem;
          text-decoration: none;
          box-sizing: border-box;
          padding: 0 12px;
          text-align: center;
          cursor: pointer;
        }
        .dm-cta-panel__primary {
          border: none;
          background: var(--dm-amber);
          color: var(--dm-graphite-980);
        }
        .dm-cta-panel__primary:hover { background: var(--dm-amber-deep); color: #fff; }
        .dm-cta-panel__call {
          border: none;
          background: #7a1f3d;
          color: #fff;
        }
        .dm-cta-panel__call:hover { background: #92264a; }
        .dm-cta-panel__whatsapp {
          border: none;
          background: #25d366;
          color: #fff;
        }
        .dm-cta-panel__whatsapp:hover { background: #1ebe57; }
        .dm-cta-panel__icon {
          font-size: 0.85rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          opacity: 0.95;
        }
        .dm-cta-panel__secondary {
          border: 1px solid rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-weight: 600;
        }
        .dm-cta-panel__secondary:hover { background: rgba(255,255,255,0.12); }
        .dm-cta-panel__warn {
          margin: 0;
          text-align: center;
          color: var(--dm-warning);
        }
        .dm-cta-panel__calc {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.12);
        }
        .dm-cta-panel__calc label {
          color: rgba(255,255,255,0.78);
        }
        .dm-cta-panel__calc select,
        .dm-cta-panel__calc input {
          background: rgba(255,255,255,0.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
        }
        .dm-cta-panel__calc select option { color: #111; }
        .dm-cta-panel__help {
          margin-top: 18px;
          text-align: center;
          color: var(--dm-amber);
          font-size: 0.9rem;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        @media (max-width: 900px) {
          .dm-cta-panel { position: static; margin-bottom: 72px; }
        }
      `}</style>
    </aside>
  );
}

export function MobileStickyApplyBar({
  price,
  financeEligible,
  monthlyEstimate,
  contactPhone,
  onApply,
}: Pick<Props, 'price' | 'financeEligible' | 'monthlyEstimate' | 'contactPhone' | 'onApply'>) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const dial = contactPhone ? toDialDigits(contactPhone) : '';
  const telHref = dial ? `tel:+${dial}` : null;

  if (!financeEligible) return null;

  return (
    <div className="dm-mobile-apply-bar" role="region" aria-label={t('detail.apply')}>
      <div className="dm-mobile-apply-bar__info">
        <MoneyText className="dm-mobile-apply-bar__price">{formatQar(price, false, locale)}</MoneyText>
        {monthlyEstimate != null && monthlyEstimate > 0 && (
          <span className="dm-mobile-apply-bar__monthly">
            {t('detail.estMonthly')}: {formatQar(Math.round(monthlyEstimate), true, locale)}
          </span>
        )}
      </div>
      <div className="dm-mobile-apply-bar__actions">
        {telHref && (
          <a href={telHref} className="dm-mobile-apply-bar__call" aria-label={t('detail.callNow')}>
            ☎
          </a>
        )}
        <button type="button" className="dm-mobile-apply-bar__apply" onClick={onApply}>
          {t('detail.apply')}
        </button>
      </div>
      <style>{`
        .dm-mobile-apply-bar {
          display: none;
          position: fixed;
          inset-inline: 0;
          bottom: 0;
          z-index: 30;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          background: var(--dm-graphite-900);
          border-top: 1px solid rgba(255,255,255,0.12);
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .dm-mobile-apply-bar__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .dm-mobile-apply-bar__price { color: #fff; font-size: 1.1rem; font-weight: 700; }
        .dm-mobile-apply-bar__monthly { font-size: 12px; color: rgba(255,255,255,0.75); }
        .dm-mobile-apply-bar__actions { display: flex; gap: 8px; flex-shrink: 0; }
        .dm-mobile-apply-bar__apply {
          border: none;
          background: var(--dm-amber);
          color: var(--dm-ink);
          font-weight: 700;
          font-size: 14px;
          padding: 12px 18px;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .dm-mobile-apply-bar__call {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #7a1f3d;
          color: #fff;
          text-decoration: none;
          font-size: 18px;
        }
        @media (max-width: 900px) {
          .dm-mobile-apply-bar { display: flex; }
        }
      `}</style>
    </div>
  );
}
