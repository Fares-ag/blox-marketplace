import type { ReactNode } from 'react';
import { OpsPageHeader } from '../../components/ops-ui';
import { OpsMetricRow, type OpsMetricItem } from '../OpsMetricRow';
import { OpsToolbar } from '../OpsToolbar';

export function OpsListPage({
  title,
  subtitle,
  headerActions,
  metrics,
  toolbar,
  children,
  error,
}: {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  metrics?: OpsMetricItem[];
  toolbar?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
}) {
  return (
    <div className="blox-page blox-list-section">
      <OpsPageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {error}
      {metrics && metrics.length > 0 && (
        <div style={{ marginBottom: 'var(--blox-space-xl)' }}>
          <OpsMetricRow metrics={metrics} />
        </div>
      )}
      {toolbar}
      {children}
    </div>
  );
}

export { OpsToolbar, OpsMetricRow };
