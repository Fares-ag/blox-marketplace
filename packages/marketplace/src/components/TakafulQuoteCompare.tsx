import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MoneyText, apiFetch, formatQar, getAppLocale, type TakafulQuoteDto } from '@drivemarket/shared';

/**
 * Indicative takaful quotes across the listed providers for one vehicle value
 * (`GET /api/takaful/providers?vehicle_price=&coverage=`), cheapest first, with
 * "Use this provider" prefilling the policy form.
 */
export type TakafulCoverage = 'comprehensive' | 'third_party';

export function takafulQuotesQueryKey(vehiclePrice: number | null, coverage: TakafulCoverage) {
  return ['takaful-providers', vehiclePrice ?? 0, coverage] as const;
}

export function fetchTakafulQuotes(vehiclePrice: number, coverage: TakafulCoverage): Promise<TakafulQuoteDto[]> {
  const params = new URLSearchParams({ vehicle_price: String(Math.round(vehiclePrice)), coverage });
  return apiFetch<TakafulQuoteDto[]>(`/api/takaful/providers?${params.toString()}`).then((rows) => (Array.isArray(rows) ? rows : []));
}

export function TakafulQuoteCompare({
  vehiclePrice,
  coverage,
  onCoverageChange,
  onUse,
  disabled,
}: {
  vehiclePrice: number | null;
  coverage: TakafulCoverage;
  onCoverageChange: (next: TakafulCoverage) => void;
  onUse: (quote: TakafulQuoteDto) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const enabled = !!vehiclePrice && vehiclePrice > 0;

  const quotes = useQuery({
    queryKey: takafulQuotesQueryKey(vehiclePrice, coverage),
    queryFn: () => fetchTakafulQuotes(vehiclePrice!, coverage),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(
    () => [...(quotes.data ?? [])].filter((q) => q.provider.active !== false).sort((a, b) => a.annual_contribution - b.annual_contribution),
    [quotes.data],
  );
  const cheapest = rows[0]?.provider.id ?? null;
  const providerName = (q: TakafulQuoteDto) => (locale === 'ar' && q.provider.name_ar ? q.provider.name_ar : q.provider.name);

  return (
    <div className="dm-tqc">
      <div className="dm-tqc__head">
        <div>
          <h4 className="dm-tqc__title">{t('takaful.compare.title')}</h4>
          {enabled ? (
            <p className="dm-tqc__intro">{t('takaful.compare.intro', { price: formatQar(vehiclePrice!, false, locale) })}</p>
          ) : (
            <p className="dm-tqc__intro">{t('takaful.compare.noPrice')}</p>
          )}
        </div>
        <div className="dm-tqc__segmented" role="radiogroup" aria-label={t('takaful.compare.coverage')}>
          {(['comprehensive', 'third_party'] as TakafulCoverage[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={coverage === value}
              className={coverage === value ? 'is-active' : ''}
              onClick={() => onCoverageChange(value)}
            >
              {value === 'comprehensive' ? t('takaful.coverageComprehensive') : t('takaful.coverageThirdParty')}
            </button>
          ))}
        </div>
      </div>

      {coverage === 'third_party' ? <p className="dm-tqc__note">{t('takaful.compare.thirdPartyNote')}</p> : null}

      {enabled && quotes.isLoading ? (
        <p className="dm-tqc__muted" role="status">
          {t('takaful.compare.loading')}
        </p>
      ) : null}
      {enabled && quotes.isError ? <p className="dm-tqc__muted">{t('takaful.compare.error')}</p> : null}
      {enabled && quotes.isSuccess && rows.length === 0 ? <p className="dm-tqc__muted">{t('takaful.compare.empty')}</p> : null}

      {rows.length > 0 ? (
        <div className="dm-tqc__table-wrap">
          <table className="dm-tqc__table">
            <thead>
              <tr>
                <th scope="col">{t('takaful.compare.provider')}</th>
                <th scope="col">{t('takaful.compare.rate')}</th>
                <th scope="col">{t('takaful.compare.annual')}</th>
                <th scope="col">{t('takaful.compare.monthly')}</th>
                <th scope="col">{t('takaful.compare.riders')}</th>
                <th scope="col">
                  <span className="dm-sr-only">{t('takaful.compare.use')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.provider.id} className={q.provider.id === cheapest ? 'is-cheapest' : ''}>
                  <td>
                    <div className="dm-tqc__provider">
                      <strong>{providerName(q)}</strong>
                      {q.provider.id === cheapest ? <span className="dm-tqc__pill">{t('takaful.compare.cheapest')}</span> : null}
                    </div>
                    <div className="dm-tqc__contact">
                      {q.provider.contact_phone ? (
                        <a href={`tel:${q.provider.contact_phone}`} dir="ltr">
                          {q.provider.contact_phone}
                        </a>
                      ) : null}
                      {q.provider.website ? (
                        <a href={q.provider.website} target="_blank" rel="noreferrer noopener">
                          {t('takaful.compare.website')}
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="dm-numeric">
                    {q.coverage_type === 'comprehensive' ? t('takaful.compare.rateValue', { rate: q.provider.comprehensive_rate_pct }) : '—'}
                  </td>
                  <td className="dm-numeric">
                    <MoneyText>{formatQar(q.annual_contribution, false, locale)}</MoneyText>
                  </td>
                  <td className="dm-numeric">
                    <MoneyText>{formatQar(q.monthly_equivalent, true, locale)}</MoneyText>
                  </td>
                  <td>
                    {q.provider.riders.length ? (
                      <ul className="dm-tqc__riders" aria-label={t('takaful.compare.riders')}>
                        {q.provider.riders.map((r) => (
                          <li key={r.code}>
                            {locale === 'ar' && r.label_ar ? r.label_ar : r.label}
                            <span className="dm-numeric"> {t('takaful.compare.riderAmount', { amount: formatQar(r.annual_amount, false, locale) })}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="dm-tqc__muted">—</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="dm-tqc__use" disabled={disabled} onClick={() => onUse(q)}>
                      {t('takaful.compare.use')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <style>{`
        .dm-tqc { display: grid; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--dm-slate-200); background: var(--dm-canvas); }
        .dm-tqc__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px 16px; }
        .dm-tqc__title { margin: 0 0 4px; font-size: 1rem; font-family: var(--dm-font-display); }
        .dm-tqc__intro { margin: 0; font-size: 13px; color: var(--dm-slate-600); line-height: 1.5; }
        .dm-tqc__note { margin: 0; font-size: 13px; color: var(--dm-warning, #c47a00); font-weight: 600; line-height: 1.45; }
        .dm-tqc__muted { margin: 0; font-size: 13px; color: var(--dm-slate-600); }
        .dm-tqc__segmented { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--dm-surface); border: 1px solid var(--dm-slate-200); flex-shrink: 0; }
        .dm-tqc__segmented button {
          border: none; background: transparent; min-height: 34px; padding: 0 14px; border-radius: 8px;
          font: inherit; font-size: 13px; font-weight: 650; color: var(--dm-slate-600); cursor: pointer;
        }
        .dm-tqc__segmented button.is-active { background: var(--dm-ink); color: #fff; }
        .dm-tqc__table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--dm-slate-200); background: var(--dm-surface); }
        .dm-tqc__table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 640px; }
        .dm-tqc__table th, .dm-tqc__table td { padding: 10px 12px; text-align: start; border-bottom: 1px solid var(--dm-slate-200); vertical-align: top; }
        .dm-tqc__table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--dm-slate-600); font-weight: 650; white-space: nowrap; }
        .dm-tqc__table tbody tr:last-child td { border-bottom: none; }
        .dm-tqc__table tr.is-cheapest td { background: var(--dm-success-soft); }
        .dm-tqc__provider { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .dm-tqc__pill { padding: 2px 8px; border-radius: 999px; background: var(--dm-success); color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .dm-tqc__contact { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; font-size: 12px; }
        .dm-tqc__contact a { color: var(--dm-steel); font-weight: 600; text-decoration: none; }
        .dm-tqc__contact a:hover { text-decoration: underline; }
        .dm-tqc__riders { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12px; }
        .dm-tqc__riders span { color: var(--dm-slate-600); }
        .dm-tqc__use {
          white-space: nowrap; min-height: 34px; padding: 0 12px; border-radius: 8px;
          border: 1.5px solid var(--dm-steel); background: transparent; color: var(--dm-ink);
          font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer;
        }
        .dm-tqc__use:hover:not(:disabled) { background: var(--dm-steel-soft); }
        .dm-tqc__use:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
