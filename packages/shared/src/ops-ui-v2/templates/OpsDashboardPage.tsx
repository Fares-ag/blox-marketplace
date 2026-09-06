import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';
import { Alert } from '../../ops-core';
import { OpsMetricRow, type OpsMetricItem } from '../OpsMetricRow';
import { PageSkeleton } from '../PageSkeleton';

/**
 * Dashboard page template — Phase 2. Header → metric row (one hero) → sections.
 * Pair with `DashboardGrid` + `DashboardSection` for the chart boilerplate.
 */
export function OpsDashboardPage({
  title,
  subtitle,
  headerActions,
  metrics,
  heroIndex = 0,
  toolbar,
  children,
  error,
  loading,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  metrics?: OpsMetricItem[];
  heroIndex?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="blox-page">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {typeof error === 'string' ? <Alert variant="error">{error}</Alert> : error}
      {metrics && metrics.length > 0 && (
        <div className="blox-page__metrics">
          <OpsMetricRow metrics={metrics} heroIndex={heroIndex} />
        </div>
      )}
      {toolbar}
      {loading ? <PageSkeleton variant="dashboard" /> : children}
    </div>
  );
}
