import type { ReactNode } from 'react';

export function PageHeader({
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

export function StatCard({
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

export type PillVariant = 'active' | 'published' | 'paid' | 'approved' | 'pending' | 'draft' | 'rejected' | 'expired';

export function StatusPill({ label, variant }: { label: string; variant: PillVariant }) {
  return <span className={`blox-pill blox-pill--${variant}`}>{label}</span>;
}

export function PrimaryButton({
  children,
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button type={type} className="blox-btn blox-btn--primary" onClick={onClick}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button type={type} className="blox-btn blox-btn--secondary" onClick={onClick}>
      {children}
    </button>
  );
}

export function DataTable({
  columns,
  rows,
  pagination,
}: {
  columns: string[];
  rows: ReactNode[][];
  pagination?: { from: number; to: number; total: number };
}) {
  return (
    <div className="blox-table-wrap">
      <table className="blox-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
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
      {pagination && (
        <div className="blox-pagination">
          <span>
            Showing {pagination.from}–{pagination.to} of {pagination.total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="blox-btn blox-btn--ghost">
              Previous
            </button>
            <button type="button" className="blox-btn blox-btn--ghost">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
