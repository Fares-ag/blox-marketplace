import React from 'react';
import { Button } from '../../core/Button/Button';
import type { SelectOption } from '../../core/Select/Select';

export interface FilterConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'range' | 'checkbox';
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onClear?: () => void;
  title?: string;
}

function isActive(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some((v) => v !== null && v !== undefined && v !== '');
  return true;
}

/**
 * Filter panel — Phase 1 §08 / Phase 2. Inline controls in a toolbar row (native inputs,
 * no MUI); active filters show a count and a single "Clear all". Filter state belongs to
 * the page (usually the URL) — this component is controlled.
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, values, onChange, onClear, title = 'Filters' }) => {
  const set = (id: string, value: any) => onChange({ ...values, [id]: value });
  const activeCount = filters.filter((f) => isActive(values[f.id])).length;

  return (
    <div className="blox-filters" role="group" aria-label={title}>
      {filters.map((filter) => {
        const value = values[filter.id];
        const active = isActive(value);
        const id = `filter-${filter.id}`;
        return (
          <div key={filter.id} className={`blox-filters__item${active ? ' is-active' : ''}`}>
            {filter.type !== 'checkbox' && (
              <label className="blox-filters__label" htmlFor={id}>
                {filter.label}
              </label>
            )}
            {filter.type === 'text' && (
              <input id={id} className="blox-filters__control" value={value ?? ''} onChange={(e) => set(filter.id, e.target.value)} placeholder={filter.label} />
            )}
            {filter.type === 'select' && (
              <select id={id} className="blox-filters__control" value={value ?? ''} onChange={(e) => set(filter.id, e.target.value)}>
                <option value="">{title === 'Filters' ? 'All' : title}</option>
                {(filter.options ?? []).map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {filter.type === 'multiselect' && (
              <div className="blox-filters__chips">
                {(filter.options ?? []).map((opt) => {
                  const selected = Array.isArray(value) && value.includes(opt.value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className={`blox-fchip${selected ? ' is-on' : ''}`}
                      aria-pressed={selected}
                      disabled={opt.disabled}
                      onClick={() =>
                        set(filter.id, selected ? (value as unknown[]).filter((v) => v !== opt.value) : [...(Array.isArray(value) ? value : []), opt.value])
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
            {filter.type === 'date' && (
              <input id={id} type="date" className="blox-filters__control" value={value ?? ''} onChange={(e) => set(filter.id, e.target.value)} />
            )}
            {filter.type === 'daterange' && (
              <div className="blox-filters__range">
                <input id={id} type="date" className="blox-filters__control" value={value?.startDate ?? ''} onChange={(e) => set(filter.id, { ...(value ?? {}), startDate: e.target.value })} aria-label={`${filter.label} from`} />
                <span aria-hidden>–</span>
                <input type="date" className="blox-filters__control" value={value?.endDate ?? ''} onChange={(e) => set(filter.id, { ...(value ?? {}), endDate: e.target.value })} aria-label={`${filter.label} to`} />
              </div>
            )}
            {filter.type === 'range' && (
              <div className="blox-filters__range">
                <input id={id} type="number" className="blox-filters__control blox-filters__control--num" min={filter.min} max={filter.max} step={filter.step} value={Array.isArray(value) ? value[0] ?? '' : ''} onChange={(e) => set(filter.id, [Number(e.target.value), Array.isArray(value) ? value[1] ?? filter.max : filter.max])} aria-label={`${filter.label} min`} />
                <span aria-hidden>–</span>
                <input type="number" className="blox-filters__control blox-filters__control--num" min={filter.min} max={filter.max} step={filter.step} value={Array.isArray(value) ? value[1] ?? '' : ''} onChange={(e) => set(filter.id, [Array.isArray(value) ? value[0] ?? filter.min : filter.min, Number(e.target.value)])} aria-label={`${filter.label} max`} />
              </div>
            )}
            {filter.type === 'checkbox' && (
              <label className="blox-filters__check">
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(filter.id, e.target.checked)} />
                <span>{filter.label}</span>
              </label>
            )}
          </div>
        );
      })}
      {activeCount > 0 && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="blox-filters__clear">
          Clear all ({activeCount})
        </Button>
      )}
    </div>
  );
};
