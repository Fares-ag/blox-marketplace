import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductCard } from '@drivemarket/shared';
import {
  MoneyText,
  formatQar,
  getAppLocale,
  formatCardFacets,
  hasWarranty,
  labelCondition,
} from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=60';

export function ListingCard({ product }: { product: ProductCard }) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const navigate = useNavigate();
  const { isCompared, toggle } = useCompareStore();
  const compared = isCompared(product.id);

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

  return (
    <Link to={`/vehicles/${product.slug}`} className="dm-listing-card">
      <div
        className="dm-listing-card__media"
        style={{
          backgroundImage: `url(${product.primary_image || FALLBACK_IMG})`,
        }}
      />
      <button
        type="button"
        className={`dm-listing-card__compare ${compared ? 'is-active' : ''}`}
        onClick={onCompareClick}
        aria-pressed={compared}
        aria-label={compared ? t('compare.remove') : t('compare.add')}
      >
        {compared ? t('compare.added') : t('compare.addShort')}
      </button>
      <div className="dm-listing-card__body">
        {(product.condition === 'new' || hasWarranty(product.warranty_months)) && (
          <div className="dm-listing-card__chips">
            {product.condition === 'new' && (
              <span className="dm-chip dm-chip--new">{labelCondition('new', t)}</span>
            )}
            {hasWarranty(product.warranty_months) && (
              <span className="dm-chip dm-chip--warranty">{t('facets.warranty')}</span>
            )}
          </div>
        )}
        <h3 className="dm-listing-card__title">
          {product.make} {product.model}
          {product.trim ? ` ${product.trim}` : ''}
        </h3>
        <p className="dm-listing-card__facets">{formatCardFacets(product, t)}</p>
        <p className="dm-listing-card__dealer">
          {product.company_code ? (
            <span
              role="link"
              tabIndex={0}
              onClick={onDealerClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onDealerClick(e as unknown as React.MouseEvent);
              }}
              className="dm-listing-card__dealer-link"
            >
              {product.company_name}
            </span>
          ) : (
            product.company_name
          )}
        </p>
        <MoneyText className="dm-listing-card__price">{formatQar(product.price, false, locale)}</MoneyText>
        {product.est_monthly != null && product.est_monthly > 0 && (
          <p className="dm-listing-card__monthly">
            {t('detail.estMonthly')}:{' '}
            <MoneyText>{formatQar(product.est_monthly, true, locale)}</MoneyText>
          </p>
        )}
      </div>
      <style>{`
        .dm-listing-card {
          position: relative;
          text-decoration: none;
          color: inherit;
          background: var(--dm-surface);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--dm-slate-200);
          transition: transform 180ms var(--dm-ease);
          display: block;
        }
        .dm-listing-card:hover { transform: translateY(-2px); }
        .dm-listing-card__media {
          aspect-ratio: 16 / 10;
          background: center / cover no-repeat var(--dm-surface-muted);
        }
        .dm-listing-card__compare {
          position: absolute;
          top: 10px;
          inset-inline-end: 10px;
          z-index: 2;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.6);
          background: rgba(22, 83, 91, 0.75);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .dm-listing-card__compare.is-active {
          background: var(--dm-amber);
          color: var(--dm-ink);
          border-color: var(--dm-amber);
        }
        .dm-listing-card__body { padding: 16px; }
        .dm-listing-card__chips { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .dm-chip {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .dm-chip--new { background: var(--dm-teal-100); color: var(--dm-teal-800); }
        .dm-chip--warranty { background: var(--dm-slate-100); color: var(--dm-slate-700); }
        .dm-listing-card__title { margin: 0 0 6px; font-size: 18px; font-family: var(--dm-font-display); }
        .dm-listing-card__facets { margin: 0 0 6px; color: var(--dm-slate-600); font-size: 13px; }
        .dm-listing-card__dealer { margin: 0 0 8px; color: var(--dm-slate-500); font-size: 12px; }
        .dm-listing-card__dealer-link {
          color: var(--dm-steel);
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .dm-listing-card__price { font-size: 18px; font-weight: 600; display: block; }
        .dm-listing-card__monthly { margin: 6px 0 0; font-size: 13px; color: var(--dm-slate-600); }
      `}</style>
    </Link>
  );
}
