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
}

export function FacetPanel({ dealers, onApplied, className = '' }: FacetPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [draft, setDraft] = useState(initial);

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
    const next = filtersToSearchParams(draft);
    const sort = searchParams.get('sort');
    if (sort) next.set('sort', sort);
    setSearchParams(next);
    onApplied?.();
  }

  function onClear() {
    const empty = parseFilters(new URLSearchParams());
    setDraft(empty);
    const sort = searchParams.get('sort');
    const next = new URLSearchParams();
    if (sort) next.set('sort', sort);
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

  const field = (label: string, key: keyof VehicleFilters, type = 'text') => (
    <label className="dm-facet-field">
      <span>{label}</span>
      <input
        type={type}
        value={String(draft[key] ?? '')}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <form className={`dm-facet-panel ${className}`.trim()} onSubmit={onSubmit}>
      <h2>{t('vehicles.filters')}</h2>
      {field(t('vehicles.searchPlaceholder'), 'q')}
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
        .dm-facet-panel h2 { margin: 0 0 4px; font-family: var(--dm-font-display); font-size: 1.1rem; }
        .dm-facet-field { display: grid; gap: 6px; font-size: 13px; color: var(--dm-slate-600); }
        .dm-facet-field input, .dm-facet-field select {
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          padding: 0 10px;
          background: #fff;
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
          min-height: 48px;
          padding: 0 16px;
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
        @media (min-width: 901px) {
          .dm-facet-mobile-trigger { display: none !important; }
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
      <button type="button" className="dm-btn-ghost dm-facet-mobile-trigger" onClick={() => onOpenChange(true)}>
        {t('vehicles.filters')}
      </button>
      {open && (
        <>
          <div className="dm-facet-sheet-backdrop" onClick={() => onOpenChange(false)} aria-hidden />
          <div className="dm-facet-sheet">
            <FacetPanel dealers={dealers} onApplied={() => onOpenChange(false)} />
          </div>
        </>
      )}
    </>
  );
}

export { FILTER_KEYS };
