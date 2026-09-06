import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';
import { Alert } from '../../ops-core';
import { OpsMetricRow, type OpsMetricItem } from '../OpsMetricRow';
import { OpsToolbar } from '../OpsToolbar';
import { PageSkeleton } from '../PageSkeleton';

/**
 * List page template — Phase 2. Header → optional metrics → toolbar → content.
 * `error` accepts a string (rendered as an inline error alert) or a node; `loading`
 * swaps the content for the list skeleton so pages need no per-page loading markup.
 */
export function OpsListPage({
  title,
  subtitle,
  headerActions,
  metrics,
  toolbar,
  children,
  error,
  loading,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  metrics?: OpsMetricItem[];
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="blox-page blox-list-section">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {typeof error === 'string' ? <Alert variant="error">{error}</Alert> : error}
      {metrics && metrics.length > 0 && (
        <div className="blox-page__metrics">
          <OpsMetricRow metrics={metrics} />
        </div>
      )}
      {toolbar}
      {loading ? <PageSkeleton variant="list" /> : children}
    </div>
  );
}

export { OpsToolbar, OpsMetricRow };
