import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { resolveListingImageUrl } from '../lib/api';
import { EmptyState, SearchBar } from '../ops-ui-v2';
import { useOpsLabels } from '../i18n/use-ops-labels';

export type VehicleCardOption = {
  id: string;
  make: string;
  model: string;
  model_year?: number;
  price: number;
  condition?: string | null;
  listing_status?: string;
  company_id?: string;
  company_name?: string;
  primary_image?: string | null;
  /** False when VIN, chassis or engine number is missing — the listing cannot be reserved yet. */
  identity_complete?: boolean;
};

const selectedCardClass = 'blox-vehicle-card--selected';

function VehicleCardBody({
  item,
  imageUrl,
  selected,
  multiple,
  statusFor,
  t,
}: {
  item: VehicleCardOption;
  imageUrl: string | null;
  selected: boolean;
  multiple: boolean;
  statusFor?: (item: VehicleCardOption) => ReactNode;
  t: (key: string, opts?: { defaultValue?: string }) => string;
}) {
  return (
    <>
      <div className="blox-vehicle-card__media">
        {imageUrl ? (
          <img src={imageUrl} alt={`${item.make} ${item.model}`} loading="lazy" />
        ) : (
          <div className="blox-vehicle-card__placeholder" aria-hidden>
            <span>No photo</span>
          </div>
        )}
      </div>
      <div className="blox-vehicle-card__body">
        <div className="blox-vehicle-card__head">
          <h4 className="blox-vehicle-card__title">
            {item.make} {item.model}
          </h4>
          <div className="blox-vehicle-card__badges">
            {selected && (
              <span className="blox-vehicle-card__selected-pill">
                {multiple ? '✓' : t('ops.common.selected')}
              </span>
            )}
            {statusFor?.(item)}
          </div>
        </div>
        <p className="blox-vehicle-card__meta">
          {item.model_year ?? '—'}
          {item.company_name ? ` · ${item.company_name}` : ''}
        </p>
        <p className="blox-vehicle-card__price">QAR {Number(item.price).toLocaleString()}</p>
      </div>
    </>
  );
}

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
  isSelectable,
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
  /** When false, the card cannot be selected (e.g. draft or reserved listings). */
  isSelectable?: (item: VehicleCardOption) => boolean;
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
        <div className="blox-vehicle-grid blox-vehicle-grid--loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="blox-vehicle-card blox-vehicle-card--skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={emptyTitle ?? t('ops.common.noResults')} />
      ) : (
        <div className={`blox-vehicle-grid${searchable ? ' blox-vehicle-grid--with-search' : ''}`}>
          {filtered.map((v) => {
            const selected = selectedIds.includes(v.id);
            const selectable = isSelectable?.(v) ?? true;
            const imageUrl = resolveListingImageUrl(v.primary_image);
            const cardClass = `blox-vehicle-card${selected ? ` ${selectedCardClass}` : ''}${
              !selectable ? ' blox-vehicle-card--disabled' : ''
            }`;

            if (hrefFor) {
              return (
                <article key={v.id} className={cardClass}>
                  {onToggle && (
                    <label className="blox-vehicle-card__checkbox">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selectable}
                        onChange={() => selectable && onToggle(v.id)}
                        aria-label={`Select ${v.make} ${v.model}`}
                      />
                    </label>
                  )}
                  <Link to={hrefFor(v)} className="blox-vehicle-card__link">
                    <VehicleCardBody
                      item={v}
                      imageUrl={imageUrl}
                      selected={selected}
                      multiple={multiple}
                      statusFor={statusFor}
                      t={t}
                    />
                  </Link>
                </article>
              );
            }

            return (
              <button
                key={v.id}
                type="button"
                className={`${cardClass} blox-vehicle-card--button`}
                disabled={!selectable}
                onClick={() => selectable && onToggle?.(v.id)}
              >
                <VehicleCardBody
                  item={v}
                  imageUrl={imageUrl}
                  selected={selected}
                  multiple={multiple}
                  statusFor={statusFor}
                  t={t}
                />
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
  statusFor,
  isSelectable,
}: {
  items: VehicleCardOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  multiple: boolean;
  loading?: boolean;
  statusFor?: (item: VehicleCardOption) => ReactNode;
  isSelectable?: (item: VehicleCardOption) => boolean;
}) {
  return (
    <VehicleCardGrid
      items={items}
      selectedIds={selectedIds}
      onToggle={onToggle}
      multiple={multiple}
      loading={loading}
      statusFor={statusFor}
      isSelectable={isSelectable}
    />
  );
}
