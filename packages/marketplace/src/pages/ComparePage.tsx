import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DocumentMeta,
  apiFetch,
  MoneyText,
  formatQar,
  getAppLocale,
  labelTransmission,
  type ProductDetailResponse,
} from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';
import { MarketplaceNav } from '../components/MarketplaceNav';

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
      <div style={{ background: 'var(--dm-graphite-900)', color: '#fff', padding: '20px 24px' }}>
        <MarketplaceNav />
        <div style={{ paddingTop: 56 }}>
          <h1 style={{ fontFamily: 'var(--dm-font-display)', margin: '0 0 8px' }}>{t('compare.title')}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{t('compare.subtitle')}</p>
        </div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {!entries.length ? (
          <div className="dm-compare-empty">
            <p>{t('compare.empty')}</p>
            <Link className="dm-btn-cta" to="/vehicles">
              {t('compare.browse')}
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button type="button" className="dm-btn-ghost dm-facet-clear" onClick={clear}>
                {t('compare.clearAll')}
              </button>
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
                    const est =
                      p && data?.offer
                        ? Math.round(
                            (() => {
                              const downPct = Number(data.offer!.min_down_payment_pct);
                              const down = (p.price * downPct) / 100;
                              const principal = Math.max(p.price - down, 0);
                              const opts = data.offer!.tenure_options || [36];
                              const tenure = opts.includes(36) ? 36 : opts[0];
                              const r = data.offer!.annual_rent_rate / 100 / 12;
                              const n = tenure;
                              if (r === 0) return principal / n;
                              const f = Math.pow(1 + r, n);
                              return (principal * r * f) / (f - 1);
                            })(),
                          )
                        : p?.est_monthly ?? null;
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
                        <td>
                          {est != null ? <MoneyText>{formatQar(est, true, locale)}</MoneyText> : '—'}
                        </td>
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
        .dm-compare-table-wrap { overflow-x: auto; background: var(--dm-surface); border-radius: 16px; border: 1px solid var(--dm-slate-200); }
        .dm-compare-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .dm-compare-table th, .dm-compare-table td { padding: 14px 16px; text-align: start; border-bottom: 1px solid var(--dm-slate-200); }
        .dm-compare-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--dm-slate-600); background: var(--dm-canvas); }
        .dm-compare-link { font-weight: 600; color: var(--dm-ink); text-decoration: none; }
        .dm-compare-link:hover { color: var(--dm-steel); }
        .dm-compare-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .dm-compare-apply { min-height: 40px; padding: 0 14px; font-size: 13px; }
        .dm-compare-remove { background: none; border: none; color: var(--dm-slate-600); cursor: pointer; font-size: 13px; text-decoration: underline; }
      `}</style>
    </div>
  );
}
