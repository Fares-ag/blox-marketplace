import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DocumentMeta,
  apiFetch,
  MoneyText,
  buildPricingSnapshot,
  formatQar,
  getAppLocale,
  labelTransmission,
  type ProductDetailResponse,
} from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';
import { MarketplaceNav } from '../components/MarketplaceNav';

function estimateMonthly(p: ProductDetailResponse['product'], offer: ProductDetailResponse['offer']) {
  if (!p || !offer) return null;
  const opts = offer.tenure_options || [36];
  const tenureMonths = opts.includes(36) ? 36 : opts[0];
  return buildPricingSnapshot({
    listPrice: p.price,
    annualRatePercent: offer.annual_rent_rate,
    minDownPaymentPct: Number(offer.min_down_payment_pct),
    tenureMonths,
  }).monthly;
}

export function ComparePage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const { entries, remove, clear } = useCompareStore();

  const results = useQueries({
    queries: entries.map((e) => ({
      queryKey: ['product', e.slug],
      queryFn: () => apiFetch<ProductDetailResponse>(`/api/products/by-slug/${e.slug}`),
    })),
  });

  const rows = entries.map((entry, i) => ({
    entry,
    data: results[i]?.data,
    loading: results[i]?.isLoading,
  }));

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <DocumentMeta title={t('meta.compareTitle')} />
      <MarketplaceNav variant="solid" />
      <div className="dm-page-head dm-page-head--brand">
        <h1>{t('compare.title')}</h1>
        <p>{t('compare.subtitle')}</p>
      </div>
      <div className="blox-page-pad blox-content-wide">
        {!entries.length ? (
          <div className="dm-compare-empty">
            <p>{t('compare.empty')}</p>
            <Link className="dm-btn-cta" to="/vehicles">
              {t('compare.browse')}
            </Link>
          </div>
        ) : (
          <>
            <div className="dm-compare-toolbar">
              <button type="button" className="dm-btn-ghost dm-facet-clear" onClick={clear}>
                {t('compare.clearAll')}
              </button>
            </div>
            <div className="dm-compare-cards">
              {rows.map(({ entry, data, loading }) => {
                const p = data?.product;
                const est = p && data?.offer ? estimateMonthly(p, data.offer) : p?.est_monthly ?? null;
                return (
                  <article key={entry.id} className="dm-compare-card">
                    <h2 className="dm-compare-card__title">
                      {loading ? t('vehicles.loading') : p ? (
                        <Link to={`/vehicles/${p.slug}`} className="dm-compare-link">
                          {p.make} {p.model}
                          {p.trim ? ` ${p.trim}` : ''}
                        </Link>
                      ) : (
                        t('detail.unavailable')
                      )}
                    </h2>
                    <dl className="dm-compare-card__rows">
                      <div>
                        <dt>{t('compare.price')}</dt>
                        <dd>{p ? <MoneyText>{formatQar(p.price, false, locale)}</MoneyText> : '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('compare.monthly')}</dt>
                        <dd>{est != null ? <MoneyText>{formatQar(est, true, locale)}</MoneyText> : '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('compare.year')}</dt>
                        <dd>{p?.model_year ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('compare.mileage')}</dt>
                        <dd>{p?.mileage != null ? `${p.mileage.toLocaleString()} ${t('facets.km')}` : '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('compare.transmission')}</dt>
                        <dd>{p?.transmission ? labelTransmission(p.transmission, t) : '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('compare.dealer')}</dt>
                        <dd>{data?.company?.name ?? '—'}</dd>
                      </div>
                    </dl>
                    <div className="dm-compare-actions">
                      {p && (
                        <Link className="dm-btn-cta dm-compare-apply" to={`/vehicles/${p.slug}`}>
                          {t('compare.viewApply')}
                        </Link>
                      )}
                      <button type="button" className="dm-compare-remove" onClick={() => remove(entry.id)}>
                        {t('compare.remove')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="dm-compare-table-wrap">
              <table className="dm-compare-table">
                <thead>
                  <tr>
                    <th>{t('compare.vehicle')}</th>
                    <th>{t('compare.price')}</th>
                    <th>{t('compare.monthly')}</th>
                    <th>{t('compare.year')}</th>
                    <th>{t('compare.mileage')}</th>
                    <th>{t('compare.transmission')}</th>
                    <th>{t('compare.dealer')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ entry, data, loading }) => {
                    const p = data?.product;
                    const est = p && data?.offer ? estimateMonthly(p, data.offer) : p?.est_monthly ?? null;
                    return (
                      <tr key={entry.id}>
                        <td>
                          {loading ? t('vehicles.loading') : p ? (
                            <Link to={`/vehicles/${p.slug}`} className="dm-compare-link">
                              {p.make} {p.model}
                              {p.trim ? ` ${p.trim}` : ''}
                            </Link>
                          ) : (
                            t('detail.unavailable')
                          )}
                        </td>
                        <td>{p ? <MoneyText>{formatQar(p.price, false, locale)}</MoneyText> : '—'}</td>
                        <td>{est != null ? <MoneyText>{formatQar(est, true, locale)}</MoneyText> : '—'}</td>
                        <td>{p?.model_year ?? '—'}</td>
                        <td>{p?.mileage != null ? `${p.mileage.toLocaleString()} ${t('facets.km')}` : '—'}</td>
                        <td>{p?.transmission ? labelTransmission(p.transmission, t) : '—'}</td>
                        <td>{data?.company?.name ?? '—'}</td>
                        <td>
                          <div className="dm-compare-actions">
                            {p && (
                              <Link className="dm-btn-cta dm-compare-apply" to={`/vehicles/${p.slug}`}>
                                {t('compare.viewApply')}
                              </Link>
                            )}
                            <button type="button" className="dm-compare-remove" onClick={() => remove(entry.id)}>
                              {t('compare.remove')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <style>{`
        .dm-compare-empty {
          text-align: center;
          padding: 48px 24px;
          background: var(--dm-surface);
          border-radius: 16px;
          border: 1px dashed var(--dm-slate-200);
        }
        .dm-compare-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;
        }
        .dm-compare-cards {
          display: none;
          flex-direction: column;
          gap: 12px;
        }
        .dm-compare-card {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 14px;
          padding: 16px;
        }
        .dm-compare-card__title {
          margin: 0 0 12px;
          font-family: var(--dm-font-display);
          font-size: 1.05rem;
        }
        .dm-compare-card__rows {
          margin: 0 0 14px;
          display: grid;
          gap: 8px;
        }
        .dm-compare-card__rows > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
        }
        .dm-compare-card__rows dt {
          margin: 0;
          color: var(--dm-slate-600);
          font-weight: 500;
        }
        .dm-compare-card__rows dd {
          margin: 0;
          text-align: end;
          font-weight: 600;
        }
        .dm-compare-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          background: var(--dm-surface);
          border-radius: 16px;
          border: 1px solid var(--dm-slate-200);
        }
        .dm-compare-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 14px; }
        .dm-compare-table th, .dm-compare-table td { padding: 14px 16px; text-align: start; border-bottom: 1px solid var(--dm-slate-200); }
        .dm-compare-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--dm-slate-600); background: var(--dm-canvas); }
        .dm-compare-link { font-weight: 600; color: var(--dm-ink); text-decoration: none; }
        .dm-compare-link:hover { color: var(--dm-steel); }
        .dm-compare-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .dm-compare-apply { min-height: 40px; padding: 0 14px; font-size: 13px; }
        .dm-compare-remove { background: none; border: none; color: var(--dm-slate-600); cursor: pointer; font-size: 13px; text-decoration: underline; }
        @media (max-width: 900px) {
          .dm-compare-table-wrap { display: none; }
          .dm-compare-cards { display: flex; }
        }
        @media (min-width: 901px) and (max-width: 1199px) {
          .dm-compare-table-wrap { overflow-x: auto; }
        }
        @media (max-width: 640px) {
          .dm-compare-table th, .dm-compare-table td { padding: 10px 12px; font-size: 13px; }
        }
      `}</style>
    </div>
  );
}
