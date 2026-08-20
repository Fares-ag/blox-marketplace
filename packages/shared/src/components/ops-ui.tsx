import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpsPillVariant } from '../config/status-styles';

export type { OpsPillVariant };

export function OpsPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="blox-page-header">
      <div>
        <h1>{title}</h1>
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
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <article className="blox-stat-card">
      <p className="blox-stat-card__label">{label}</p>
      <p className="blox-stat-card__value blox-money">{value}</p>
      {delta && <p className="blox-stat-card__delta">{delta}</p>}
    </article>
  );
}

export function OpsStatusPill({ label, variant }: { label: string; variant: OpsPillVariant }) {
  return <span className={`blox-pill blox-pill--${variant}`}>{label}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function OpsPrimaryButton({ children, className, ...rest }: BtnProps) {
  return (
    <button type="button" className={`blox-btn blox-btn--primary${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function OpsSecondaryButton({ children, className, ...rest }: BtnProps) {
  return (
    <button type="button" className={`blox-btn blox-btn--secondary${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function OpsGhostButton({ children, className, ...rest }: BtnProps) {
  return (
    <button type="button" className={`blox-btn blox-btn--ghost${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function OpsDangerButton({ children, className, ...rest }: BtnProps) {
  return (
    <button type="button" className={`blox-btn blox-btn--danger${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function OpsEmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="blox-empty">
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
}) {
  const { t } = useTranslation();

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

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
              {columns.map((col) => (
                <th key={col || 'actions'}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
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
