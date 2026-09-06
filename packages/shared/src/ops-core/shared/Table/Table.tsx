import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Rows3, Rows4 } from 'lucide-react';
import { TableSkeleton } from '../Skeleton/Skeleton';
import { EmptyState } from '../EmptyState/EmptyState';
import { Alert } from '../Alert/Alert';

/**
 * Unified ops table — Phase 1 §05 (+ sorting, density and keyboard navigation).
 * Deep-green header, 44px (regular) / 36px (compact) rows, hover wash, emerald-soft
 * selection with an inset rail, attached pagination footer, skeleton / empty / error
 * states, and an automatic card fallback under the `md` breakpoint.
 *
 * Column flags drive the card fallback: `cardTitle` lifts a column to the card heading,
 * `cardStatus` to the top-right, `actions` to the card footer, `hideOnCard` drops it.
 * `sortable` columns sort client-side over the current page (server paging stays the source of order).
 */
export interface Column<T extends object = Record<string, unknown>> {
  id: string;
  label: string;
  minWidth?: number;
  width?: number | string;
  align?: 'right' | 'left' | 'center';
  /** Right-aligned, mono, tabular digits. */
  numeric?: boolean;
  /** Mono without right alignment — IDs and references. */
  mono?: boolean;
  /** Row-level actions: right-aligned, and rendered in the card footer on mobile. */
  actions?: boolean;
  cardTitle?: boolean;
  cardStatus?: boolean;
  hideOnCard?: boolean;
  sortable?: boolean;
  /** Value used for sorting when the raw field is not what is displayed. */
  sortValue?: (row: T) => string | number | null | undefined;
  format?: (value: any, row: T) => React.ReactNode;
}

export type TableDensity = 'regular' | 'compact';

export interface TableProps<T extends object = Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  /** Zero-based page index (kept from the MUI-era API). */
  page?: number;
  rowsPerPage?: number;
  rowsPerPageOptions?: number[];
  /** When provided, the pagination footer renders. */
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  /** Inline error shown above the header; the last good rows stay visible underneath. */
  error?: React.ReactNode;
  rowKey?: (row: T, index: number) => string;
  /** Initial density; the user's choice is remembered per browser. */
  density?: TableDensity;
  /** Hide the density toggle in the footer. */
  densityToggle?: boolean;
  /** Adds a checkbox column. Selection is controlled through `selectedKeys`. */
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Rendered in the bulk bar while at least one row is selected. */
  bulkActions?: React.ReactNode;
  /** Replaces the built-in pagination footer (used by the OpsDataTable adapter). */
  footer?: React.ReactNode;
  defaultSort?: { id: string; dir: 'asc' | 'desc' };
  caption?: string;
  className?: string;
}

const DENSITY_KEY = 'blox.tableDensity';

function readDensity(fallback: TableDensity): TableDensity {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    return v === 'compact' || v === 'regular' ? v : fallback;
  } catch {
    return fallback;
  }
}

function renderCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '';
  if (React.isValidElement(value)) return value;
  switch (typeof value) {
    case 'string':
    case 'number':
      return value;
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
  }
}

function defaultRowKey<T extends object>(row: T, index: number): string {
  const id = (row as { id?: unknown }).id;
  return id !== undefined && id !== null ? String(id) : String(index);
}

function cellClass<T extends object>(column: Column<T>): string | undefined {
  const classes = [
    column.numeric ? 'blox-table__num' : '',
    column.mono ? 'blox-table__mono' : '',
    column.actions ? 'blox-table__actions' : '',
    column.align === 'right' && !column.numeric ? 'blox-table__end' : '',
    column.align === 'center' ? 'blox-table__center' : '',
  ].filter(Boolean);
  return classes.length ? classes.join(' ') : undefined;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const da = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) ? Date.parse(a) : NaN;
  const db = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b) ? Date.parse(b) : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function Table<T extends object>({
  columns,
  rows,
  loading = false,
  page = 0,
  rowsPerPage = 25,
  rowsPerPageOptions = [25, 50, 100],
  totalRows,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  emptyTitle,
  emptyMessage = 'No data available',
  emptyAction,
  error,
  rowKey = defaultRowKey,
  density: densityProp = 'regular',
  densityToggle = true,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  bulkActions,
  footer,
  defaultSort,
  caption,
  className = '',
}: TableProps<T>) {
  const { t } = useTranslation();
  const [density, setDensity] = useState<TableDensity>(() => readDensity(densityProp));
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* private mode */
    }
  }, [density]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column) return rows;
    const value = (row: T) =>
      column.sortValue ? column.sortValue(row) : (row as unknown as Record<string, unknown>)[column.id];
    const copy = rows.map((row, index) => ({ row, index }));
    copy.sort((a, b) => {
      const c = compare(value(a.row), value(b.row));
      return (sort.dir === 'asc' ? c : -c) || a.index - b.index;
    });
    return copy.map((x) => x.row);
  }, [rows, sort, columns]);

  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const keys = useMemo(() => sortedRows.map((row, index) => rowKey(row, index)), [sortedRows, rowKey]);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = keys.some((k) => selected.has(k));

  const titleCol = columns.find((c) => c.cardTitle) ?? columns.find((c) => !c.actions && !c.numeric);
  const statusCol = columns.find((c) => c.cardStatus);
  const actionCols = columns.filter((c) => c.actions);
  const cardFieldCols = columns.filter((c) => c !== titleCol && c !== statusCol && !c.actions && !c.hideOnCard);

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? selectedKeys.filter((k) => !keys.includes(k)) : Array.from(new Set([...selectedKeys, ...keys])));
  };
  const toggleOne = (key: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selected.has(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]);
  };
  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    setSort((prev) => {
      if (!prev || prev.id !== column.id) return { id: column.id, dir: 'asc' };
      if (prev.dir === 'asc') return { id: column.id, dir: 'desc' };
      return null;
    });
  };

  const cell = (column: Column<T>, row: T) => {
    const value = (row as unknown as Record<string, unknown>)[column.id];
    return column.format ? column.format(value, row) : renderCellValue(value);
  };

  // ↑/↓ move focus between rows, Enter opens, Space toggles selection.
  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, row: T, key: string) {
    if (e.target !== e.currentTarget) return;
    const rowsEls = Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[tabindex]') ?? []);
    const idx = rowsEls.indexOf(e.currentTarget);
    if (e.key === 'ArrowDown' && idx < rowsEls.length - 1) {
      e.preventDefault();
      rowsEls[idx + 1]?.focus();
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      rowsEls[idx - 1]?.focus();
    } else if (e.key === 'Enter' && onRowClick) {
      onRowClick(row);
    } else if (e.key === ' ' && selectable) {
      e.preventDefault();
      toggleOne(key);
    }
  }

  const pageCount = totalRows !== undefined ? Math.max(1, Math.ceil(totalRows / rowsPerPage)) : 1;
  const from = totalRows ? page * rowsPerPage + 1 : 0;
  const to = totalRows ? Math.min(totalRows, (page + 1) * rowsPerPage) : 0;

  const densityControl =
    densityToggle && rows.length > 5 ? (
      <button
        type="button"
        className="blox-pagination__density"
        aria-pressed={density === 'compact'}
        title={density === 'compact' ? t('ops.pagination.densityRegular') : t('ops.pagination.densityCompact')}
        aria-label={density === 'compact' ? t('ops.pagination.densityRegular') : t('ops.pagination.densityCompact')}
        onClick={() => setDensity((d) => (d === 'compact' ? 'regular' : 'compact'))}
      >
        {density === 'compact' ? <Rows3 size={15} strokeWidth={1.75} /> : <Rows4 size={15} strokeWidth={1.75} />}
      </button>
    ) : null;

  const paginationFooter =
    footer !== undefined ? (
      <div className="blox-pagination-wrap">
        {footer}
        {densityControl && <div className="blox-pagination blox-pagination--tools">{densityControl}</div>}
      </div>
    ) : totalRows !== undefined || densityControl ? (
      <div className="blox-pagination">
        {totalRows !== undefined && (
          <span className="blox-pagination__range">{t('ops.pagination.showing', { from, to, total: totalRows })}</span>
        )}
        {onRowsPerPageChange && (
          <label className="blox-pagination__size">
            <span>{t('ops.pagination.rowsPerPage')}</span>
            <span className="blox-segmented blox-segmented--light" role="group">
              {rowsPerPageOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === rowsPerPage ? 'is-active' : undefined}
                  aria-pressed={n === rowsPerPage}
                  onClick={() => onRowsPerPageChange(n)}
                >
                  {n}
                </button>
              ))}
            </span>
          </label>
        )}
        <div className="blox-pagination__nav">
          {densityControl}
          {totalRows !== undefined && (
            <>
              <button
                type="button"
                className="blox-btn blox-btn--ghost blox-btn--sm"
                disabled={!onPageChange || page <= 0}
                onClick={() => onPageChange?.(page - 1)}
              >
                ‹ {t('ops.pagination.previous')}
              </button>
              <span className="blox-pagination__page">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="blox-btn blox-btn--ghost blox-btn--sm"
                disabled={!onPageChange || page + 1 >= pageCount}
                onClick={() => onPageChange?.(page + 1)}
              >
                {t('ops.pagination.next')} ›
              </button>
            </>
          )}
        </div>
      </div>
    ) : null;

  if (loading && rows.length === 0) {
    return (
      <div className={`blox-data-table ${className}`.trim()}>
        <TableSkeleton rows={Math.min(rowsPerPage, 8)} columns={columns.length + (selectable ? 1 : 0)} />
      </div>
    );
  }

  if (!loading && rows.length === 0 && !error) {
    return (
      <div className={`blox-data-table ${className}`.trim()}>
        <EmptyState title={emptyTitle ?? t('ops.common.noResults', { defaultValue: 'No results' })} message={emptyMessage} />
        {emptyAction ? <div className="blox-empty__action blox-data-table__empty-action">{emptyAction}</div> : null}
      </div>
    );
  }

  return (
    <div className={`blox-data-table${loading ? ' is-loading' : ''} ${className}`.trim()} aria-busy={loading || undefined}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {selectable && selected.size > 0 && (
        <div className="blox-table__bulk" role="region" aria-live="polite">
          <span className="blox-table__bulk-count">{t('ops.pagination.selected', { count: selected.size })}</span>
          <span className="blox-table__bulk-actions">{bulkActions}</span>
        </div>
      )}
      <div className="blox-table-wrap">
        <table className={`blox-table${density === 'compact' ? ' blox-table--compact' : ''}${onRowClick ? ' blox-table--clickable' : ''}`}>
          {caption ? <caption className="blox-visually-hidden">{caption}</caption> : null}
          <thead>
            <tr>
              {selectable && (
                <th className="blox-table__check">
                  <input
                    type="checkbox"
                    aria-label={t('ops.pagination.selectAll', { defaultValue: 'Select all rows' })}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => {
                const sorted = sort?.id === column.id ? sort.dir : undefined;
                return (
                  <th
                    key={column.id}
                    className={[cellClass(column), column.sortable ? 'is-sortable' : '', sorted ? 'is-sorted' : ''].filter(Boolean).join(' ') || undefined}
                    style={column.minWidth || column.width ? { minWidth: column.minWidth, width: column.width } : undefined}
                    scope="col"
                    aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sortable ? (
                      <button type="button" className="blox-table__sort" onClick={() => toggleSort(column)}>
                        {column.label}
                        {sorted === 'asc' ? <ArrowUp size={12} /> : sorted === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} className="blox-table__sort-idle" />}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {sortedRows.map((row, index) => {
              const key = keys[index];
              const isSelected = selectable && selected.has(key);
              return (
                <tr
                  key={key}
                  className={isSelected ? 'is-selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick || selectable ? 0 : undefined}
                  onKeyDown={onRowClick || selectable ? (e) => onRowKeyDown(e, row, key) : undefined}
                >
                  {selectable && (
                    <td className="blox-table__check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={t('ops.pagination.selectRow', { defaultValue: 'Select row' })}
                        checked={isSelected}
                        onChange={() => toggleOne(key)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cellClass(column)}
                      onClick={column.actions ? (e) => e.stopPropagation() : undefined}
                    >
                      {cell(column, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {paginationFooter}
      </div>
      <div className="blox-table-cards">
        {sortedRows.map((row, index) => {
          const key = keys[index];
          const isSelected = selectable && selected.has(key);
          return (
            <article
              key={key}
              className={`blox-table-card${isSelected ? ' is-selected' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {(titleCol || statusCol || selectable) && (
                <div className="blox-table-card__top">
                  {selectable && (
                    <input
                      type="checkbox"
                      aria-label={t('ops.pagination.selectRow', { defaultValue: 'Select row' })}
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleOne(key)}
                    />
                  )}
                  {titleCol && <span className="blox-table-card__title">{cell(titleCol, row)}</span>}
                  {statusCol && <span className="blox-table-card__status">{cell(statusCol, row)}</span>}
                </div>
              )}
              <dl className="blox-table-card__fields">
                {cardFieldCols.map((column) => (
                  <div key={column.id} className="blox-table-card__field">
                    <dt>{column.label}</dt>
                    <dd className={column.numeric || column.mono ? 'blox-table__mono' : undefined}>{cell(column, row)}</dd>
                  </div>
                ))}
              </dl>
              {actionCols.length > 0 && (
                <div className="blox-table-card__actions">
                  {actionCols.map((column) => (
                    <React.Fragment key={column.id}>{cell(column, row)}</React.Fragment>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {paginationFooter}
      </div>
    </div>
  );
}
