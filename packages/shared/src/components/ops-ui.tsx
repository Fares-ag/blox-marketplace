import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpsPillVariant } from '../config/status-styles';
import { Button, type ButtonProps } from '../ops-core';

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
  const { t } = useTranslation();

  if (rows.length === 0 && empty) {
    return (
      <div className="blox-table-wrap">
        <div className="blox-empty" style={{ padding: '48px 24px' }}>
          {empty}
        </div>
      </div>
    );
  }

  const numericSet = new Set(numericColumns ?? []);
  const actionsColIndex =
    columns.length > 0 &&
    (columns[columns.length - 1] === '' || columns[columns.length - 1].toLowerCase() === 'actions')
      ? columns.length - 1
      : -1;
  const fieldColIndices = columns.map((_, index) => index).filter((index) => index !== actionsColIndex);

  const paginationBlock = pagination ? (
    <div className="blox-pagination">
      <span>
        {t('ops.pagination.showing', {
          from: pagination.from,
          to: pagination.to,
          total: pagination.total,
        })}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="blox-btn blox-btn--ghost"
          disabled={!pagination.onPrev || pagination.from <= 1}
          onClick={pagination.onPrev}
        >
          {t('ops.pagination.previous')}
        </button>
        <button
          type="button"
          className="blox-btn blox-btn--ghost"
          disabled={!pagination.onNext || pagination.to >= pagination.total}
          onClick={pagination.onNext}
        >
          {t('ops.pagination.next')}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="blox-data-table">
      <div className="blox-table-wrap">
        <table className="blox-table">
          <thead>
            <tr>
              {columns.map((col, j) => (
                <th key={col || 'actions'} className={numericSet.has(j) ? 'blox-table__num' : undefined}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={numericSet.has(j) ? 'blox-table__num' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {paginationBlock}
      </div>
      <div className="blox-table-cards">
        {rows.map((row, i) => (
          <article key={i} className="blox-table-card">
            <dl className="blox-table-card__fields">
              {fieldColIndices.map((colIndex) => (
                <div key={colIndex} className="blox-table-card__field">
                  <dt>{columns[colIndex]}</dt>
                  <dd>{row[colIndex]}</dd>
                </div>
              ))}
            </dl>
            {actionsColIndex >= 0 && row[actionsColIndex] != null && (
              <div className="blox-table-card__actions">{row[actionsColIndex]}</div>
            )}
          </article>
        ))}
        {paginationBlock}
      </div>
    </div>
  );
}
