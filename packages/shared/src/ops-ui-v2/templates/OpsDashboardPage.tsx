import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';
import { OpsMetricRow, type OpsMetricItem } from '../OpsMetricRow';

export function OpsDashboardPage({
  title,
  subtitle,
  headerActions,
  metrics,
  heroIndex = 0,
  toolbar,
  children,
  error,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  metrics?: OpsMetricItem[];
  heroIndex?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
}) {
  return (
    <div className="blox-page">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {error}
      {metrics && metrics.length > 0 && (
        <div style={{ marginBottom: 'var(--blox-space-xl)' }}>
          <OpsMetricRow metrics={metrics} heroIndex={heroIndex} />
        </div>
      )}
      {toolbar}
      {children}
    </div>
  );
}
