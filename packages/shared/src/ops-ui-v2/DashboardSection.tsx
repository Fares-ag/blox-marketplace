import type { ReactNode } from 'react';
import { Alert, EmptyState, Skeleton } from '../ops-core';

/**
 * Dashboard section — Phase 2. One titled card with the loading, empty and error
 * treatment every dashboard needs, so pages stop re-implementing chart boilerplate.
 */
export function DashboardSection({
  title,
  subtitle,
  actions,
  loading,
  error,
  empty,
  emptyTitle,
  emptyMessage,
  span = 1,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: ReactNode;
  /** When true the empty state renders instead of children. */
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Grid span inside `.blox-dashboard-grid` (1–3). */
  span?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`blox-detail-section blox-dashboard-card blox-dashboard-card--span-${span} ${className}`.trim()}>
      <header className="blox-dashboard-card__head">
        <div>
          <h2 className="blox-panel__title">{title}</h2>
          {subtitle && <p className="blox-dashboard-card__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="blox-dashboard-card__actions">{actions}</div>}
      </header>
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : loading ? (
        <div className="blox-dashboard-card__skeleton" aria-busy>
          <Skeleton height={12} width="55%" />
          <Skeleton height={160} width="100%" />
          <Skeleton height={12} width="35%" />
        </div>
      ) : empty ? (
        <EmptyState title={emptyTitle ?? 'Nothing to show yet'} message={emptyMessage ?? 'Data appears here as soon as there is activity.'} />
      ) : (
        <div className="blox-dashboard-card__body">{children}</div>
      )}
    </section>
  );
}

/** Responsive grid for DashboardSection cards: 3 columns ≥ 1200, 2 ≥ 900, 1 below. */
export function DashboardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`blox-dashboard-grid ${className}`.trim()}>{children}</div>;
}
