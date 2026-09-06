import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpsPillVariant } from '../config/status-styles';
import { Button, Table, type ButtonProps, type Column } from '../ops-core';

export type { OpsPillVariant };

export function OpsPageHeader({
  title,
  subtitle,
  actions,
  sticky,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header className={`blox-page-header${sticky ? ' blox-page-header--sticky' : ''}`}>
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="blox-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="blox-page-header__actions">{actions}</div>}
    </header>
  );
}

export function OpsStatCard({
  label,
  value,
  delta,
  variant = 'default',
}: {
  label: string;
  value: string;
  delta?: string;
  variant?: 'default' | 'hero' | 'dark';
}) {
  const variantClass =
    variant === 'hero' ? ' blox-stat-card--hero' : variant === 'dark' ? ' blox-stat-card--dark' : '';
  return (
    <article className={`blox-stat-card${variantClass}`}>
      <p className="blox-stat-card__label">{label}</p>
      <p className="blox-stat-card__value blox-money">{value}</p>
      {delta && <p className="blox-stat-card__delta">{delta}</p>}
    </article>
  );
}

export function OpsStatusPill({ label, variant }: { label: string; variant: OpsPillVariant }) {
  return <span className={`blox-pill blox-pill--${variant}`}>{label}</span>;
}

type BtnProps = Omit<ButtonProps, 'variant'>;

export function OpsPrimaryButton({ children, className, ...rest }: BtnProps) {
  return (
    <Button variant="primary" className={className} {...rest}>
      {children}
    </Button>
  );
}

export function OpsSecondaryButton({ children, className, ...rest }: BtnProps) {
  return (
    <Button variant="secondary" className={className} {...rest}>
      {children}
    </Button>
  );
}

export function OpsGhostButton({ children, className, ...rest }: BtnProps) {
  return (
    <Button variant="tertiary" className={className} {...rest}>
      {children}
    </Button>
  );
}

export function OpsDangerButton({ children, className, ...rest }: BtnProps) {
  return (
    <Button variant="destructive" className={className} {...rest}>
      {children}
    </Button>
  );
}

export function OpsEmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="blox-empty">
      {icon && <div className="blox-empty__icon">{icon}</div>}
      <p className="blox-empty__title">{title}</p>
      {body && <p className="blox-empty__body">{body}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function OpsPanel({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="blox-panel">
      {(title || actions) && (
        <div className={actions ? 'blox-panel__head' : undefined}>
          {title && <h2 className="blox-panel__title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function OpsDataTable({
  columns,
  rows,
  pagination,
  empty,
  numericColumns,
}: {
  columns: string[];
  rows: ReactNode[][];
  pagination?: {
    from: number;
    to: number;
    total: number;
    onPrev?: () => void;
    onNext?: () => void;
  };
  empty?: ReactNode;
  numericColumns?: number[];
}) {
  // Adapter over the unified ops-core Table (Phase 1 §05): string columns and ReactNode
  // rows become column definitions and keyed row objects, so every portal renders through
  // one implementation. New pages should use <Table> directly.
  const { t } = useTranslation();
  const numericSet = new Set(numericColumns ?? []);
  const actionsColIndex =
    columns.length > 0 &&
    (columns[columns.length - 1] === '' || columns[columns.length - 1].toLowerCase() === 'actions')
      ? columns.length - 1
      : -1;

  type AdapterRow = Record<string, ReactNode>;
  const tableColumns: Column<AdapterRow>[] = columns.map((label, j) => ({
    id: `c${j}`,
    label,
    numeric: numericSet.has(j),
    actions: j === actionsColIndex,
    cardTitle: j === 0 && j !== actionsColIndex && !numericSet.has(0),
    format: (value: ReactNode) => value,
  }));
  const tableRows: AdapterRow[] = rows.map((cells) =>
    Object.fromEntries(cells.map((cell, j) => [`c${j}`, cell])),
  );

  const footer = pagination ? (
    <div className="blox-pagination">
      <span className="blox-pagination__range">
        {t('ops.pagination.showing', {
          from: pagination.from,
          to: pagination.to,
          total: pagination.total,
        })}
      </span>
      <div className="blox-pagination__nav">
        <button
          type="button"
          className="blox-btn blox-btn--ghost blox-btn--sm"
          disabled={!pagination.onPrev || pagination.from <= 1}
          onClick={pagination.onPrev}
        >
          ‹ {t('ops.pagination.previous')}
        </button>
        <button
          type="button"
          className="blox-btn blox-btn--ghost blox-btn--sm"
          disabled={!pagination.onNext || pagination.to >= pagination.total}
          onClick={pagination.onNext}
        >
          {t('ops.pagination.next')} ›
        </button>
      </div>
    </div>
  ) : undefined;

  return (
    <Table<AdapterRow>
      columns={tableColumns}
      rows={tableRows}
      rowKey={(_, index) => String(index)}
      footer={footer}
      emptyMessage={typeof empty === 'string' ? empty : undefined}
      emptyAction={empty && typeof empty !== 'string' ? empty : undefined}
    />
  );
}
