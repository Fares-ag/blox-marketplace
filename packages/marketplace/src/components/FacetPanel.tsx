import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, type PublicCompany } from '@drivemarket/shared';

export type VehicleFilters = {
  q: string;
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  priceMin: string;
  priceMax: string;
  condition: string;
  transmission: string;
  drivetrain: string;
  bodyType: string;
  cylinders: string;
  mileageMax: string;
  hasWarranty: boolean;
  companyId: string;
};

export type BrowseSort = 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';

const FILTER_KEYS: (keyof VehicleFilters)[] = [
  'q', 'make', 'model', 'yearMin', 'yearMax', 'priceMin', 'priceMax',
  'condition', 'transmission', 'drivetrain', 'bodyType', 'cylinders',
  'mileageMax', 'hasWarranty', 'companyId',
];

export function parseFilters(params: URLSearchParams): VehicleFilters {
  return {
    q: params.get('q') ?? '',
    make: params.get('make') ?? '',
    model: params.get('model') ?? '',
    yearMin: params.get('yearMin') ?? '',
    yearMax: params.get('yearMax') ?? '',
    priceMin: params.get('priceMin') ?? '',
    priceMax: params.get('priceMax') ?? '',
    condition: params.get('condition') ?? '',
    transmission: params.get('transmission') ?? '',
    drivetrain: params.get('drivetrain') ?? '',
    bodyType: params.get('bodyType') ?? '',
    cylinders: params.get('cylinders') ?? '',
    mileageMax: params.get('mileageMax') ?? '',
    hasWarranty: params.get('hasWarranty') === 'true',
    companyId: params.get('companyId') ?? '',
  };
}

export function parseBrowseParams(params: URLSearchParams) {
  return {
    filters: parseFilters(params),
    sort: (params.get('sort') as BrowseSort) || 'newest',
    offset: Math.max(Number(params.get('offset') ?? 0) || 0, 0),
    limit: Math.min(Math.max(Number(params.get('limit') ?? 24) || 24, 1), 100),
  };
}

export function filtersToSearchParams(filters: VehicleFilters): URLSearchParams {
  const params = new URLSearchParams();
  (Object.entries(filters) as [keyof VehicleFilters, string | boolean][]).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      if (value) params.set(key, 'true');
      return;
    }
    if (value) params.set(key, value);
  });
  return params;
}

export function buildProductsQuery(
  filters: VehicleFilters,
  opts?: { sort?: BrowseSort; offset?: number; limit?: number },
): string {
  const params = filtersToSearchParams(filters);
  if (opts?.sort && opts.sort !== 'newest') params.set('sort', opts.sort);
  if (opts?.offset && opts.offset > 0) params.set('offset', String(opts.offset));
  if (opts?.limit && opts.limit !== 24) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

type FacetOptions = {
  makes: string[];
  models_by_make: Record<string, string[]>;
};

interface FacetPanelProps {
  dealers: PublicCompany[];
  onApplied?: () => void;
  className?: string;
  variant?: 'top' | 'sidebar';
}

export function FacetPanel({ dealers, onApplied, className = '', variant = 'top' }: FacetPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [draft, setDraft] = useState(initial);
  // Start collapsed so the grid does not dominate the page; the header button
  // (rendered for the `top` variant) expands it on demand.
  const [expanded, setExpanded] = useState(false);

  const facets = useQuery({
    queryKey: ['product-facet-options'],
    queryFn: () => apiFetch<FacetOptions>('/api/products/facet-options'),
  });

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const modelOptions = useMemo(() => {
    if (!draft.make || !facets.data) return [];
    const key = Object.keys(facets.data.models_by_make).find(
      (m) => m.toLowerCase() === draft.make.toLowerCase(),
    );
    return key ? facets.data.models_by_make[key] : [];
  }, [draft.make, facets.data]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = filtersToSearchParams({
      ...draft,
      q: searchParams.get('q') ?? '',
    });
    const sort = searchParams.get('sort');
    if (sort) next.set('sort', sort);
    setSearchParams(next);
    onApplied?.();
  }

  function onClear() {
    const empty = parseFilters(new URLSearchParams());
    const sort = searchParams.get('sort');
    const keyword = searchParams.get('q');
    const next = new URLSearchParams();
    if (sort) next.set('sort', sort);
    if (keyword) next.set('q', keyword);
    setDraft({ ...empty, q: keyword ?? '' });
    setSearchParams(next);
    onApplied?.();
  }

  function onMakeChange(make: string) {
    setDraft((prev) => ({
      ...prev,
      make,
      model: '',
    }));
  }

  const field = (label: string, key: keyof VehicleFilters, type = 'text', wide = false) => (
    <label className={`dm-facet-field${wide ? ' dm-facet-field--wide' : ''}`}>
      <span>{label}</span>
      <input
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );

  const isTop = variant === 'top';

  return (
    <form
      className={`dm-facet-panel ${isTop ? 'dm-facet-panel--top' : 'dm-facet-panel--sidebar'} ${className}`.trim()}
      onSubmit={onSubmit}
    >
      {isTop ? (
        <button
          type="button"
          className="dm-facet-top-head"
          aria-expanded={expanded}
          aria-controls="dm-facet-grid"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="dm-facet-top-title">{t('vehicles.filters')}</span>
          <span className={`dm-facet-chevron${expanded ? ' is-open' : ''}`} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      ) : (
        <h2>{t('vehicles.filters')}</h2>
      )}

      <div
        id="dm-facet-grid"
        className={`dm-facet-grid${isTop && !expanded ? ' is-collapsed' : ''}`}
        hidden={isTop && !expanded}
      >
        <label className="dm-facet-field">
          <span>{t('vehicles.make')}</span>
          <select value={draft.make} onChange={(e) => onMakeChange(e.target.value)}>
            <option value="">—</option>
            {(facets.data?.makes ?? []).map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </label>
        <label className="dm-facet-field">
          <span>{t('vehicles.model')}</span>
          <select
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            disabled={!draft.make}
          >
            <option value="">—</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        {field(t('vehicles.yearMin'), 'yearMin', 'number')}
        {field(t('vehicles.yearMax'), 'yearMax', 'number')}
        {field(t('vehicles.priceMin'), 'priceMin', 'number')}
        {field(t('vehicles.priceMax'), 'priceMax', 'number')}
        <label className="dm-facet-field">
          <span>{t('vehicles.condition')}</span>
          <select value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })}>
            <option value="">—</option>
            <option value="new">{t('facets.new')}</option>
            <option value="used">{t('facets.used')}</option>
          </select>
        </label>
        <label className="dm-facet-field">
          <span>{t('vehicles.transmission')}</span>
          <select value={draft.transmission} onChange={(e) => setDraft({ ...draft, transmission: e.target.value })}>
            <option value="">—</option>
            <option value="automatic">{t('facets.automatic')}</option>
            <option value="manual">{t('facets.manual')}</option>
          </select>
        </label>
        <label className="dm-facet-field">
          <span>{t('vehicles.drivetrain')}</span>
          <select value={draft.drivetrain} onChange={(e) => setDraft({ ...draft, drivetrain: e.target.value })}>
            <option value="">—</option>
            <option value="fwd">{t('facets.fwd')}</option>
            <option value="rwd">{t('facets.rwd')}</option>
            <option value="awd">{t('facets.awd')}</option>
            <option value="four_wd">{t('facets.fourWd')}</option>
          </select>
        </label>
        <label className="dm-facet-field">
          <span>{t('vehicles.bodyType')}</span>
          <select value={draft.bodyType} onChange={(e) => setDraft({ ...draft, bodyType: e.target.value })}>
            <option value="">—</option>
            <option value="sedan">{t('facets.sedan')}</option>
            <option value="suv">{t('facets.suv')}</option>
            <option value="coupe">{t('facets.coupe')}</option>
            <option value="hatchback">{t('facets.hatchback')}</option>
            <option value="pickup">{t('facets.pickup')}</option>
            <option value="van">{t('facets.van')}</option>
            <option value="other">{t('facets.other')}</option>
          </select>
        </label>
        {field(t('vehicles.cylinders'), 'cylinders', 'number')}
        {field(t('vehicles.mileageMax'), 'mileageMax', 'number')}
        <label className="dm-facet-field dm-facet-field--check">
          <input
            type="checkbox"
            checked={draft.hasWarranty}
            onChange={(e) => setDraft({ ...draft, hasWarranty: e.target.checked })}
          />
          <span>{t('vehicles.hasWarranty')}</span>
        </label>
        <label className="dm-facet-field">
          <span>{t('vehicles.dealer')}</span>
          <select value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}>
            <option value="">{t('vehicles.allDealers')}</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="dm-facet-actions">
          <button type="submit" className="dm-btn-cta">{t('vehicles.applyFilters')}</button>
          <button type="button" className="dm-btn-ghost dm-facet-clear" onClick={onClear}>{t('vehicles.clearFilters')}</button>
        </div>
      </div>
      <style>{`
        .dm-facet-panel {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 16px;
          padding: 20px;
          display: grid;
          gap: 12px;
          align-self: start;
        }
        .dm-facet-panel--top {
          width: 100%;
          padding: 16px 20px;
        }
        .dm-facet-panel--sidebar {
          align-self: start;
        }
        .dm-facet-top-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          margin: 0;
          padding: 0;
          border: none;
          background: none;
          font: inherit;
          color: inherit;
          cursor: pointer;
          text-align: start;
        }
        .dm-facet-top-head h2,
        .dm-facet-top-title {
          margin: 0;
          font-family: var(--dm-font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--dm-ink);
        }
        .dm-facet-chevron {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--dm-slate-600);
          transition: transform 0.18s ease;
          flex-shrink: 0;
        }
        .dm-facet-chevron.is-open {
          transform: rotate(180deg);
        }
        .dm-facet-grid {
          display: grid;
          gap: 12px;
        }
        .dm-facet-panel--top .dm-facet-grid.is-collapsed,
        .dm-facet-panel--top .dm-facet-grid[hidden] {
          display: none;
        }
        .dm-facet-panel--sidebar .dm-facet-grid {
          grid-template-columns: 1fr;
        }
        .dm-facet-panel--top .dm-facet-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          align-items: end;
        }
        .dm-facet-panel--top .dm-facet-field--wide {
          grid-column: span 2;
        }
        .dm-facet-panel--top .dm-facet-field--check {
          align-self: center;
          padding-bottom: 8px;
        }
        .dm-facet-panel--top .dm-facet-actions {
          grid-column: span 2;
          justify-content: flex-end;
          margin-top: 0;
        }
        .dm-facet-panel h2 { margin: 0 0 4px; font-family: var(--dm-font-display); font-size: 1.1rem; }
        .dm-facet-field { display: grid; gap: 6px; font-size: 13px; color: var(--dm-slate-600); min-width: 0; }
        .dm-facet-field input, .dm-facet-field select {
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          padding: 0 10px;
          background: #fff;
          width: 100%;
          box-sizing: border-box;
        }
        .dm-facet-field select:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .dm-facet-field--check { grid-template-columns: auto 1fr; align-items: center; }
        .dm-facet-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .dm-facet-clear {
          border: 1px solid var(--dm-slate-200) !important;
          color: var(--dm-ink) !important;
          min-height: 40px;
          padding: 0 16px;
        }
        .dm-facet-panel--top .dm-btn-cta {
          min-height: 40px;
          padding: 0 18px;
          font-size: 0.9rem;
        }
        .dm-facet-sheet-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 63, 69, 0.45);
          z-index: 40;
        }
        .dm-facet-sheet {
          position: fixed;
          inset-inline: 0;
          bottom: 0;
          max-height: 85vh;
          overflow: auto;
          z-index: 41;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
        }
        @media (max-width: 1120px) {
          .dm-facet-panel--top .dm-facet-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .dm-facet-panel--top .dm-facet-field--wide {
            grid-column: span 2;
          }
          .dm-facet-panel--top .dm-facet-actions {
            grid-column: span 4;
          }
        }
        @media (min-width: 1600px) {
          .dm-facet-panel--top .dm-facet-grid {
            grid-template-columns: repeat(8, minmax(0, 1fr));
          }
          .dm-facet-panel--top .dm-facet-field--wide {
            grid-column: span 2;
          }
          .dm-facet-panel--top .dm-facet-actions {
            grid-column: span 2;
          }
        }
        @media (min-width: 1920px) {
          .dm-facet-panel--top {
            padding: 18px 20px;
          }
        }
        @media (max-width: 640px) {
          .dm-facet-panel--top {
            padding: 12px 14px;
          }
          .dm-facet-panel--top .dm-facet-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dm-facet-panel--top .dm-facet-field--wide,
          .dm-facet-panel--top .dm-facet-actions {
            grid-column: span 2;
          }
        }
        @media (max-width: 480px) {
          .dm-facet-panel--top .dm-facet-grid {
            grid-template-columns: 1fr;
          }
          .dm-facet-panel--top .dm-facet-field--wide,
          .dm-facet-panel--top .dm-facet-actions {
            grid-column: span 1;
          }
          .dm-facet-actions {
            flex-direction: column;
          }
          .dm-facet-actions .dm-btn-cta,
          .dm-facet-actions .dm-facet-clear {
            width: 100%;
          }
        }
        @media (min-width: 901px) {
          .dm-facet-sheet-backdrop, .dm-facet-sheet { display: none !important; }
        }
        @media (max-width: 900px) {
          .dm-facet-sidebar { display: none !important; }
        }
      `}</style>
    </form>
  );
}

export function FacetMobileTrigger({
  dealers,
  open,
  onOpenChange,
}: {
  dealers: PublicCompany[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" className="dm-facet-mobile-trigger" onClick={() => onOpenChange(true)}>
        {t('vehicles.filters')}
      </button>
      {open && (
        <>
          <div className="dm-facet-sheet-backdrop" onClick={() => onOpenChange(false)} aria-hidden />
          <div className="dm-facet-sheet" role="dialog" aria-label={t('vehicles.filters')}>
            <FacetPanel dealers={dealers} onApplied={() => onOpenChange(false)} />
          </div>
        </>
      )}
      <style>{`
        .dm-facet-mobile-trigger {
          display: none;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border: 1.5px solid var(--dm-slate-200);
          border-radius: 8px;
          background: var(--dm-surface);
          color: var(--dm-ink);
          font: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
        }
        .dm-facet-mobile-trigger:hover {
          border-color: var(--dm-steel);
          background: var(--dm-steel-soft);
        }
        .dm-facet-sheet-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 63, 69, 0.45);
          z-index: 40;
        }
        .dm-facet-sheet {
          position: fixed;
          inset-inline: 0;
          bottom: 0;
          max-height: 85vh;
          overflow: auto;
          z-index: 41;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
          background: var(--dm-surface);
        }
        @media (max-width: 900px) {
          .dm-facet-mobile-trigger { display: inline-flex; }
        }
      `}</style>
    </>
  );
}

export { FILTER_KEYS };
