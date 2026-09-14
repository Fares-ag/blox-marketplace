import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductCard } from '@drivemarket/shared';
import {
  MoneyText,
  formatQar,
  getAppLocale,
  hasWarranty,
  labelCondition,
  labelTransmission,
  resolveListingImageUrl,
} from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';
import { toDialDigits } from './ListingCtaPanel';

export function ListingCard({
  product,
  variant = 'row',
  /** On a dealer showroom page the header already names the dealer — hide the chip. */
  showroom = false,
}: {
  product: ProductCard;
  variant?: 'grid' | 'row';
  showroom?: boolean;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const navigate = useNavigate();
  const { isCompared, toggle } = useCompareStore();
  const compared = isCompared(product.id);
  const isNew = product.condition === 'new';
  const gear = labelTransmission(product.transmission, t);
  const mileageLabel =
    product.mileage != null
      ? `${product.mileage.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-QA')} ${t('facets.km')}`
      : '—';
  const listingTitle = `${product.make} ${product.model}${product.trim ? ` ${product.trim}` : ''}`.trim();
  const dial = product.company_contact_phone ? toDialDigits(product.company_contact_phone) : '';
  const telHref = dial ? `tel:+${dial}` : null;
  const waHref = dial
    ? `https://api.whatsapp.com/send?phone=${dial}&text=${encodeURIComponent(
        t('detail.whatsappPrefill', { listing: listingTitle }),
      )}`
    : null;
  const detailHref = `/vehicles/${product.slug}`;
  const imageUrl = resolveListingImageUrl(product.primary_image);
  const hasPhoto = Boolean(imageUrl);

  function onCompareClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle({ id: product.id, slug: product.slug });
  }

  function onDealerClick(e: React.MouseEvent) {
    if (!product.company_code) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(`/dealers/${product.company_code}`);
  }

  const showDealer = !showroom && Boolean(product.company_name);

  return (
    <article className={`dm-listing-card dm-listing-card--${variant}${showroom ? ' dm-listing-card--showroom' : ''}`}>
      <Link
        to={detailHref}
        className="dm-listing-card__overlay"
        aria-label={listingTitle}
      />
      <div
        className={`dm-listing-card__media${hasPhoto ? '' : ' dm-listing-card__media--no-photo'}`}
        style={hasPhoto ? { backgroundImage: `url(${imageUrl})` } : undefined}
      >
        {!hasPhoto && (
          <span className="dm-listing-card__no-photo" aria-hidden>
            {t('detail.noPhotos')}
          </span>
        )}
        {isNew && <span className="dm-listing-card__new-ribbon">{labelCondition('new', t)}</span>}
      </div>

      <div className="dm-listing-card__identity">
        <p className="dm-listing-card__make">{product.make}</p>
        <h3 className="dm-listing-card__model">
          {product.model}
          {product.trim ? ` ${product.trim}` : ''}
        </h3>
        <div className="dm-listing-card__meta-row">
          {showDealer &&
            (product.company_code ? (
              <button type="button" className="dm-listing-card__dealer-chip" onClick={onDealerClick}>
                {product.company_name}
              </button>
            ) : (
              <span className="dm-listing-card__dealer-chip">{product.company_name}</span>
            ))}
          {hasWarranty(product.warranty_months) && (
            <span className="dm-listing-card__warranty">{t('facets.warranty')}</span>
          )}
        </div>
      </div>

      <dl className="dm-listing-card__specs">
        <div>
          <dt>{t('facets.year')}</dt>
          <dd>{product.model_year}</dd>
        </div>
        <div>
          <dt>{t('vehicles.transmission')}</dt>
          <dd>{gear || '—'}</dd>
        </div>
        <div>
          <dt>{t('vehicles.cylinders')}</dt>
          <dd>{product.cylinders ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('facets.mileage')}</dt>
          <dd>{mileageLabel}</dd>
        </div>
      </dl>

      <div className="dm-listing-card__aside">
        <button
          type="button"
          className={`dm-listing-card__compare ${compared ? 'is-active' : ''}`}
          onClick={onCompareClick}
          aria-pressed={compared}
          aria-label={compared ? t('compare.remove') : t('compare.add')}
        >
          {compared ? t('compare.added') : t('compare.addShort')}
        </button>
        <div className="dm-listing-card__pricing">
          <MoneyText className="dm-listing-card__price">
            {formatQar(product.price, false, locale)}
          </MoneyText>
          {product.est_monthly != null && product.est_monthly > 0 && (
            <p className="dm-listing-card__monthly">
              {t('detail.estMonthly')}{' '}
              <MoneyText>{formatQar(product.est_monthly, true, locale)}</MoneyText>
            </p>
          )}
        </div>
        {(telHref || waHref) && (
          <div className="dm-listing-card__contact">
            {telHref && (
              <a href={telHref} className="dm-listing-card__call" aria-label={t('detail.callNow')}>
                {t('detail.callNow')}
              </a>
            )}
            {waHref && (
              <a
                href={waHref}
                className="dm-listing-card__whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('detail.whatsapp')}
              >
                {t('detail.whatsapp')}
              </a>
            )}
          </div>
        )}
      </div>

      <style>{`
        .dm-listing-card {
          position: relative;
          display: grid;
          grid-template-columns: 140px minmax(120px, 1.1fr) minmax(140px, 1fr) minmax(140px, 0.95fr);
          align-items: stretch;
          gap: 0;
          text-decoration: none;
          color: inherit;
          background: var(--dm-surface);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--dm-slate-200);
          transition: box-shadow 180ms ease, border-color 180ms ease;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 118px;
          cursor: pointer;
        }
        .dm-listing-card:hover {
          border-color: var(--dm-steel);
          box-shadow: 0 4px 16px rgba(15, 63, 69, 0.08);
        }
        .dm-listing-card__overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          border-radius: inherit;
          text-decoration: none;
        }
        .dm-listing-card__overlay:focus-visible {
          outline: 2px solid var(--dm-steel);
          outline-offset: 2px;
        }
        .dm-listing-card__compare,
        .dm-listing-card__dealer-chip,
        .dm-listing-card__call,
        .dm-listing-card__whatsapp {
          position: relative;
          z-index: 2;
        }
        .dm-listing-card__media {
          position: relative;
          background: center / cover no-repeat var(--dm-surface-muted);
          min-height: 118px;
          align-self: stretch;
        }
        .dm-listing-card__media--no-photo {
          display: grid;
          place-items: center;
          background: var(--dm-surface-muted);
        }
        .dm-listing-card__no-photo {
          padding: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-align: center;
          color: var(--dm-slate-600);
          line-height: 1.35;
          max-width: 90%;
        }
        .dm-listing-card__new-ribbon {
          position: absolute;
          inset-inline-end: 0;
          top: 0;
          bottom: 0;
          width: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          background: var(--dm-success, #00cfa2);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dm-listing-card__identity {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          padding: 12px 14px;
          min-width: 0;
        }
        .dm-listing-card__make {
          margin: 0;
          font-family: var(--dm-font-display);
          font-size: clamp(1.05rem, 2vw, 1.35rem);
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--dm-ink);
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dm-listing-card__model {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--dm-slate-600);
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dm-listing-card__meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }
        .dm-listing-card__dealer-chip {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 3px 8px;
          border: none;
          border-radius: 4px;
          background: var(--dm-steel-soft);
          color: var(--dm-ink);
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }
        .dm-listing-card__warranty {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 4px;
          background: var(--dm-surface-muted);
          color: var(--dm-slate-600);
          font-size: 11px;
          font-weight: 600;
        }
        .dm-listing-card__specs {
          margin: 0;
          padding: 12px 16px;
          display: grid;
          gap: 6px;
          align-content: center;
          min-width: 0;
        }
        .dm-listing-card__specs > div {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          font-size: 13px;
          min-width: 0;
        }
        .dm-listing-card__specs dt {
          margin: 0;
          color: var(--dm-slate-600);
          font-weight: 500;
          line-height: 1.3;
        }
        .dm-listing-card__specs dd {
          margin: 0;
          font-weight: 700;
          color: var(--dm-ink);
          line-height: 1.3;
          font-variant-numeric: tabular-nums;
          overflow: visible;
          white-space: normal;
          word-break: break-word;
        }
        .dm-listing-card__aside {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 14px;
          min-width: 0;
        }
        .dm-listing-card__compare {
          border: 1px solid var(--dm-slate-200);
          background: var(--dm-surface-muted);
          color: var(--dm-ink);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          line-height: 1.2;
        }
        .dm-listing-card__compare.is-active {
          background: var(--dm-amber);
          border-color: var(--dm-amber);
          color: var(--dm-ink);
        }
        .dm-listing-card__pricing {
          text-align: end;
        }
        .dm-listing-card__price {
          display: block;
          font-size: clamp(1.05rem, 2.2vw, 1.35rem);
          font-weight: 700;
          color: var(--dm-graphite-900);
          line-height: 1.15;
        }
        .dm-listing-card__monthly {
          margin: 4px 0 0;
          font-size: 11px;
          color: var(--dm-slate-600);
          line-height: 1.3;
        }
        .dm-listing-card__contact {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
          width: 100%;
        }
        .dm-listing-card__call,
        .dm-listing-card__whatsapp {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
          line-height: 1;
          white-space: nowrap;
        }
        .dm-listing-card__call {
          border: 1.5px solid var(--dm-steel);
          color: var(--dm-ink);
          background: transparent;
        }
        .dm-listing-card__call:hover {
          background: var(--dm-steel-soft);
        }
        .dm-listing-card__whatsapp {
          background: #25d366;
          color: #fff;
        }
        .dm-listing-card__whatsapp:hover {
          background: #1ebe57;
        }

        /* Dealer showroom: taller photo, no redundant dealer chip, specs in a tidy grid. */
        .dm-listing-card--showroom {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "media"
            "identity"
            "specs"
            "aside";
          min-height: 0;
        }
        .dm-listing-card--showroom .dm-listing-card__media {
          grid-area: media;
          width: 100%;
          min-height: 200px;
          aspect-ratio: 16 / 10;
        }
        .dm-listing-card--showroom .dm-listing-card__new-ribbon {
          writing-mode: horizontal-tb;
          transform: none;
          inset-inline-end: auto;
          inset-inline-start: 12px;
          top: 12px;
          bottom: auto;
          width: auto;
          height: auto;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .dm-listing-card--showroom .dm-listing-card__identity {
          grid-area: identity;
          padding: 14px 16px 8px;
        }
        .dm-listing-card--showroom .dm-listing-card__specs {
          grid-area: specs;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 20px;
          padding: 4px 16px 12px;
        }
        .dm-listing-card--showroom .dm-listing-card__specs > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }
        .dm-listing-card--showroom .dm-listing-card__aside {
          grid-area: aside;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 16px;
          border-top: 1px solid var(--dm-slate-200);
        }
        .dm-listing-card--showroom .dm-listing-card__pricing {
          text-align: start;
        }
        .dm-listing-card--showroom .dm-listing-card__contact {
          justify-content: flex-start;
        }

        @media (min-width: 1600px) {
          .dm-listing-card:not(.dm-listing-card--showroom) {
            grid-template-columns: 160px minmax(140px, 1.2fr) minmax(160px, 1fr) minmax(150px, 0.95fr);
            min-height: 132px;
          }
          .dm-listing-card:not(.dm-listing-card--showroom) .dm-listing-card__media { min-height: 132px; }
        }
        @media (min-width: 1920px) {
          .dm-listing-card:not(.dm-listing-card--showroom) {
            grid-template-columns: 168px minmax(120px, 1.15fr) minmax(140px, 1fr) minmax(140px, 0.9fr);
            min-height: 128px;
          }
        }

        @media (max-width: 900px) {
          .dm-listing-card--showroom {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas:
              "media"
              "identity"
              "specs"
              "aside";
            min-height: 0;
          }
          .dm-listing-card--showroom .dm-listing-card__media {
            min-height: 180px;
            aspect-ratio: 16 / 10;
          }
          .dm-listing-card--showroom .dm-listing-card__identity {
            padding: 14px 16px 8px;
          }
          .dm-listing-card--showroom .dm-listing-card__specs {
            padding: 4px 16px 12px;
            gap: 12px 16px;
          }
          .dm-listing-card--showroom .dm-listing-card__aside {
            flex-direction: row;
            align-items: center;
            padding: 12px 16px 16px;
            border-top: 1px solid var(--dm-slate-200);
          }
          .dm-listing-card {
            grid-template-columns: 120px minmax(0, 1fr) auto;
            grid-template-areas:
              "media identity aside"
              "media specs specs";
            min-height: 108px;
          }
          .dm-listing-card__media { grid-area: media; min-height: 100%; }
          .dm-listing-card__identity {
            grid-area: identity;
            padding: 10px 12px 4px;
          }
          .dm-listing-card__specs {
            grid-area: specs;
            grid-template-columns: 1fr 1fr;
            gap: 4px 12px;
            padding: 4px 12px 12px;
          }
          .dm-listing-card__specs > div {
            grid-template-columns: 84px minmax(0, 1fr);
            gap: 8px;
            font-size: 12px;
          }
          .dm-listing-card--showroom .dm-listing-card__specs > div {
            display: flex;
            flex-direction: column;
            grid-template-columns: unset;
          }
          .dm-listing-card__aside {
            grid-area: aside;
            padding: 10px 12px;
            align-items: flex-end;
          }
        }

        @media (max-width: 640px) {
          .dm-listing-card {
            grid-template-columns: 104px minmax(0, 1fr) auto;
            min-height: 96px;
          }
          .dm-listing-card__media { min-height: 100%; }
          .dm-listing-card__new-ribbon { width: 16px; font-size: 8px; }
          .dm-listing-card__identity { padding: 8px 10px 2px; }
          .dm-listing-card__make { font-size: 0.98rem; }
          .dm-listing-card__model { font-size: 0.75rem; }
          .dm-listing-card__meta-row { gap: 4px; margin-top: 2px; }
          .dm-listing-card__dealer-chip,
          .dm-listing-card__warranty { font-size: 10px; padding: 2px 6px; }
          .dm-listing-card__specs {
            grid-template-columns: 1fr 1fr;
            padding: 2px 10px 8px;
            gap: 2px 8px;
            border-top: none;
          }
          .dm-listing-card__specs > div { font-size: 11px; }
          .dm-listing-card__aside {
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            padding: 8px 10px;
            gap: 6px;
          }
          .dm-listing-card__pricing { text-align: end; }
          .dm-listing-card__compare { padding: 4px 8px; font-size: 10px; }
          .dm-listing-card__price { font-size: 0.98rem; }
          .dm-listing-card__monthly { font-size: 10px; }
          .dm-listing-card__call,
          .dm-listing-card__whatsapp {
            min-height: 26px;
            padding: 0 8px;
            font-size: 10px;
          }
        }

        @media (max-width: 480px) {
          .dm-listing-card:not(.dm-listing-card--showroom) {
            grid-template-columns: 88px minmax(0, 1fr) auto;
            min-height: 88px;
          }
          .dm-listing-card__specs {
            grid-template-columns: 1fr 1fr;
          }
          .dm-listing-card:not(.dm-listing-card--showroom) .dm-listing-card__specs > div:nth-child(n + 3) {
            display: none;
          }
        }

        @media (max-width: 360px) {
          .dm-listing-card:not(.dm-listing-card--showroom) {
            grid-template-columns: 76px minmax(0, 1fr);
            grid-template-areas:
              "media identity"
              "media aside";
            min-height: 84px;
          }
          .dm-listing-card:not(.dm-listing-card--showroom) .dm-listing-card__specs { display: none; }
          .dm-listing-card__aside {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            padding: 0 8px 8px;
            width: 100%;
          }
          .dm-listing-card__pricing { text-align: start; }
          .dm-listing-card__contact {
            justify-content: flex-start;
            order: 3;
            width: 100%;
          }
        }
      `}</style>
    </article>
  );
}
