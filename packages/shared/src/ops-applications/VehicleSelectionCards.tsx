import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { bloxTokens } from '../config/blox-tokens';
import { resolveListingImageUrl } from '../lib/api';
import { EmptyState, SearchBar } from '../ops-ui-v2';
import { useOpsLabels } from '../i18n/use-ops-labels';

export type VehicleCardOption = {
  id: string;
  make: string;
  model: string;
  model_year?: number;
  price: number;
  listing_status?: string;
  company_id?: string;
  company_name?: string;
  primary_image?: string | null;
};

const selectedCardStyle = {
  borderColor: bloxTokens.emerald,
  background: bloxTokens.emeraldSoft,
  boxShadow: 'var(--blox-shadow-hover)',
  transform: 'translateY(-2px)',
} as const;

export function VehicleCardGrid({
  items,
  loading,
  searchable = true,
  selectedIds = [],
  onToggle,
  multiple = false,
  hrefFor,
  statusFor,
  emptyTitle,
}: {
  items: VehicleCardOption[];
  loading?: boolean;
  searchable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  multiple?: boolean;
  hrefFor?: (item: VehicleCardOption) => string;
  statusFor?: (item: VehicleCardOption) => ReactNode;
  emptyTitle?: string;
}) {
  const { t } = useOpsLabels();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((v) =>
      `${v.make} ${v.model} ${v.model_year ?? ''} ${v.company_name ?? ''} ${v.listing_status ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  return (
    <div className="blox-list-section">
      {searchable && (
        <SearchBar value={query} onChange={setQuery} placeholder={t('ops.wizard.selectVehicle')} />
      )}
      {loading ? (
        <div
          className="blox-metrics-grid"
          style={{ marginTop: searchable ? 'var(--spacing-lg)' : 0 }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="blox-detail-section" style={{ minHeight: 132, opacity: 0.6 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={emptyTitle ?? t('ops.common.noResults')} />
      ) : (
        <div
          className="blox-metrics-grid"
          style={{ marginTop: searchable ? 'var(--spacing-lg)' : 0 }}
        >
          {filtered.map((v) => {
            const selected = selectedIds.includes(v.id);
            const imageUrl = resolveListingImageUrl(v.primary_image);
            const body = (
              <>
                <div
                  className="blox-vehicle-card__media"
                  style={{
                    height: 96,
                    margin: 'calc(-1 * var(--spacing-lg)) calc(-1 * var(--spacing-lg)) var(--spacing-md)',
                    borderBottom: `1px solid ${bloxTokens.border}`,
                    borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
                    overflow: 'hidden',
                    background: imageUrl
                      ? undefined
                      : `linear-gradient(135deg, ${bloxTokens.canvas}, ${bloxTokens.emeraldSoft})`,
                  }}
                >
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={`${v.make} ${v.model}`}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    {v.make} {v.model}
                  </h4>
                  {selected && !hrefFor && (
                    <span
                      style={{
                        background: bloxTokens.emerald,
                        color: bloxTokens.deepGreen,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      {multiple ? '✓' : t('ops.common.selected')}
                    </span>
                  )}
                  {statusFor?.(v)}
                </div>
                <p style={{ margin: '4px 0 0', color: 'var(--secondary-text)', fontSize: '0.875rem' }}>
                  {v.model_year ?? '—'}
                  {v.company_name ? ` · ${v.company_name}` : ''}
                </p>
                <p style={{ margin: '12px 0 0', color: bloxTokens.deepGreen, fontWeight: 700, fontSize: '1.125rem' }}>
                  QAR {Number(v.price).toLocaleString()}
                </p>
              </>
            );

            if (hrefFor) {
              return (
                <article
                  key={v.id}
                  className="blox-detail-section"
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    ...(selected ? selectedCardStyle : {}),
                  }}
                >
                  {onToggle && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggle(v.id)}
                      style={{ marginTop: 4 }}
                    />
                  )}
                  <Link to={hrefFor(v)} style={{ color: 'inherit', textDecoration: 'none', minWidth: 0, flex: 1 }}>
                    {body}
                  </Link>
                </article>
              );
            }

            return (
              <button
                key={v.id}
                type="button"
                className="blox-detail-section"
                onClick={() => onToggle?.(v.id)}
                style={{
                  width: '100%',
                  textAlign: 'start',
                  cursor: 'pointer',
                  ...(selected ? selectedCardStyle : {}),
                }}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VehicleSelectionCards({
  items,
  selectedIds,
  onToggle,
  multiple,
  loading,
}: {
  items: VehicleCardOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  multiple: boolean;
  loading?: boolean;
}) {
  return (
    <VehicleCardGrid
      items={items}
      selectedIds={selectedIds}
      onToggle={onToggle}
      multiple={multiple}
      loading={loading}
    />
  );
}
