/**
 * Dealer-branded customer entry (`/dealers/:code/apply`): the dealer's logo,
 * colours and name with "Financing by Blox", their finance-eligible vehicles
 * with Apply CTAs (guests are routed through sign-in with a `returnUrl`), and
 * the eligibility checker.
 */
import type { CSSProperties } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DocumentMeta,
  MoneyText,
  apiFetch,
  formatQar,
  getAppLocale,
  labelCondition,
  resolveListingImageUrl,
  useAuthStore,
  type ProductCard,
  type ProductListResponse,
} from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';
import { BrandBadge, useBrand } from '../components/BrandProvider';
import { Notice } from './apply/fields';

export function BrandedEntryPage() {
  const { code } = useParams();
  const { t } = useTranslation();
  const locale = getAppLocale();
  const brand = useBrand();
  const user = useAuthStore((s) => s.user);

  const products = useQuery({
    queryKey: ['products', 'branded-entry', brand.company?.id],
    queryFn: () => apiFetch<ProductListResponse>(`/api/products?companyId=${encodeURIComponent(brand.company!.id)}&limit=100&sort=newest`),
    enabled: !!brand.company?.id,
  });

  if (!code) return <Navigate to="/dealers" replace />;

  const displayName = brand.displayName ?? brand.companyName ?? '';
  const style = {
    '--dm-brand-primary': brand.primary ?? 'var(--dm-graphite-900)',
    '--dm-brand-on-primary': brand.primary ? undefined : '#ffffff',
    '--dm-brand-accent': brand.accent ?? 'var(--dm-amber)',
    '--dm-brand-on-accent': brand.accent ? undefined : 'var(--dm-ink)',
  } as CSSProperties;

  if (brand.isLoading) {
    return (
      <div className="dm-brand-entry" style={style}>
        <header className="dm-band dm-brand-entry__hero">
          <div className="dm-band__inner">
            <MarketplaceNav />
            <p className="dm-band__lead" role="status">
              {t('vehicles.loading')}
            </p>
          </div>
        </header>
      </div>
    );
  }

  if (!brand.isBranded || !brand.company) {
    return (
      <div className="dm-brand-entry">
        <DocumentMeta title={t('applyFlow.branded.notFound')} />
        <header className="dm-band">
          <div className="dm-band__inner">
            <MarketplaceNav />
            <h1>{t('applyFlow.branded.notFound')}</h1>
          </div>
        </header>
        <main className="dm-brand-entry__body">
          <div className="dm-band__inner">
            <p>
              <Link className="dm-btn-cta" to="/dealers">
                {t('applyFlow.branded.backToDealers')}
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  const items = (products.data?.items ?? []).filter((p) => p.finance_eligible && p.availability !== 'pending_financing');

  return (
    <div className="dm-brand-entry" style={style}>
      <DocumentMeta title={t('applyFlow.branded.title', { dealer: displayName })} description={brand.tagline ?? t('applyFlow.branded.tagline')} />
      <header className="dm-band dm-brand-entry__hero">
        <div className="dm-band__inner">
          <MarketplaceNav />
          <div className="dm-brand-entry__hero-grid">
            <div className="dm-brand-entry__copy">
              <BrandBadge size="lg" />
              <p className="dm-band__eyebrow">{t('applyFlow.branded.eyebrow')}</p>
              <h1>{t('applyFlow.branded.title', { dealer: displayName })}</h1>
              <p className="dm-band__lead">{brand.tagline ?? t('applyFlow.branded.tagline')}</p>
              <div className="dm-brand-entry__hero-actions">
                <a href="#branded-listings" className="dm-brand-entry__cta">
                  {t('applyFlow.branded.listingsTitle')}
                </a>
                <Link to="/eligibility" className="dm-btn-ghost dm-brand-entry__ghost">
                  {t('applyFlow.branded.checkEligibility')}
                </Link>
              </div>
            </div>
            <ol className="dm-brand-entry__how" aria-label={t('applyFlow.branded.how.title')}>
              {(['s1', 's2', 's3'] as const).map((key, index) => (
                <li key={key}>
                  <span className="dm-brand-entry__how-num dm-numeric" aria-hidden>
                    {index + 1}
                  </span>
                  <div>
                    <p className="dm-brand-entry__how-title">{t(`applyFlow.branded.how.${key}`)}</p>
                    <p className="dm-brand-entry__how-body">{t(`applyFlow.branded.how.${key}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </header>

      <main className="dm-brand-entry__body" id="branded-listings">
        <div className="dm-band__inner">
          <div className="dm-brand-entry__list-head">
            <div>
              <h2>{t('applyFlow.branded.listingsTitle')}</h2>
              {products.data ? <p className="dm-muted">{t('applyFlow.branded.listingsCount', { count: items.length })}</p> : null}
            </div>
            <Link to={`/dealers/${encodeURIComponent(code)}`} className="dm-linkbtn">
              {t('applyFlow.branded.browse')}
            </Link>
          </div>

          {products.isLoading ? <p className="dm-muted">{t('vehicles.loading')}</p> : null}
          {products.isError ? <Notice tone="danger">{(products.error as Error).message}</Notice> : null}
          {products.isSuccess && items.length === 0 ? (
            <div className="dm-brand-entry__empty">
              <p>{t('applyFlow.branded.empty')}</p>
              <Link className="dm-btn-ghost dm-btn-ghost--on-light" to="/eligibility">
                {t('applyFlow.branded.checkEligibility')}
              </Link>
            </div>
          ) : null}

          <ul className="dm-brand-entry__grid">
            {items.map((p) => (
              <BrandedListing key={p.id} product={p} signedIn={!!user} locale={locale} />
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

function BrandedListing({ product, signedIn, locale }: { product: ProductCard; signedIn: boolean; locale: string }) {
  const { t } = useTranslation();
  const title = `${product.make} ${product.model}${product.trim ? ` ${product.trim}` : ''}`.trim();
  const imageUrl = resolveListingImageUrl(product.primary_image);
  const applyPath = `/app/applications/new?product=${encodeURIComponent(product.slug)}`;
  const applyHref = signedIn ? applyPath : `/auth/login?returnUrl=${encodeURIComponent(applyPath)}`;
  const eligibilityHref = `/eligibility?price=${product.price}&condition=${product.condition}&year=${product.model_year}&product=${encodeURIComponent(product.slug)}`;

  return (
    <li className="dm-brand-card">
      <Link to={`/vehicles/${product.slug}`} className={`dm-brand-card__media${imageUrl ? '' : ' is-empty'}`} style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} aria-label={title}>
        {!imageUrl ? <span aria-hidden>{t('detail.noPhotos')}</span> : null}
      </Link>
      <div className="dm-brand-card__body">
        <p className="dm-brand-card__make">{product.make}</p>
        <h3 className="dm-brand-card__title">
          {product.model}
          {product.trim ? ` ${product.trim}` : ''}
        </h3>
        <p className="dm-brand-card__meta">
          <span className="dm-numeric">{product.model_year}</span>
          <span> · {labelCondition(product.condition, t)}</span>
          {product.mileage != null ? (
            <span>
              {' '}
              · <span className="dm-numeric">{product.mileage.toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-QA')}</span> {t('facets.km')}
            </span>
          ) : null}
        </p>
        <p className="dm-brand-card__price">
          <MoneyText>{formatQar(product.price, false, locale)}</MoneyText>
        </p>
        {product.est_monthly != null && product.est_monthly > 0 ? (
          <p className="dm-brand-card__monthly">{t('applyFlow.branded.estMonthly', { amount: formatQar(product.est_monthly, true, locale) })}</p>
        ) : null}
        <div className="dm-brand-card__actions">
          <Link to={applyHref} className="dm-brand-card__apply">
            {signedIn ? t('applyFlow.branded.apply') : t('applyFlow.branded.signInToApply')}
          </Link>
          <div className="dm-brand-card__links">
            <Link to={`/vehicles/${product.slug}`} className="dm-linkbtn">
              {t('applyFlow.branded.details')}
            </Link>
            <Link to={eligibilityHref} className="dm-linkbtn">
              {t('applyFlow.branded.eligibilityFor')}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
