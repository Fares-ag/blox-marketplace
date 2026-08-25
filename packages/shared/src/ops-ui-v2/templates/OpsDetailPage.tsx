import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OpsStatusPill } from '../../components/ops-ui';
import type { OpsPillVariant } from '../../config/status-styles';
import { OpsTabs, OpsTab } from '../OpsTabs';

export function OpsDetailPage({
  backTo,
  backLabel,
  title,
  idLabel,
  status,
  statusVariant: _statusVariant,
  headerActions,
  tabs,
  activeTab,
  onTabChange,
  children,
  sticky = true,
}: {
  backTo: string;
  backLabel?: string;
  title: string;
  idLabel?: string;
  status?: { label: string; variant: OpsPillVariant };
  statusVariant?: never;
  headerActions?: ReactNode;
  tabs?: Array<{ value: string; label: string }>;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  children: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div className="blox-page blox-detail-page">
      <header className={`blox-page-header blox-detail-header${sticky ? ' blox-page-header--sticky' : ''}`}>
        <div className="blox-detail-header__start">
          <Link to={backTo} className="blox-detail-back">
            ← {backLabel ?? 'Back'}
          </Link>
          <div>
            <h1>{title}</h1>
            {idLabel && <p className="blox-detail-id">{idLabel}</p>}
          </div>
        </div>
        <div className="blox-page-header__actions blox-detail-header__actions">
          {status && <OpsStatusPill label={status.label} variant={status.variant} />}
          {headerActions}
        </div>
      </header>
      {tabs && tabs.length > 0 && activeTab && onTabChange && (
        <OpsTabs tabVariant="workspace" value={activeTab} onChange={(_, v) => onTabChange(v)} sx={{ mb: 2 }}>
          {tabs.map((t) => (
            <OpsTab key={t.value} value={t.value} label={t.label} />
          ))}
        </OpsTabs>
      )}
      {children}
    </div>
  );
}

export function OpsDetailGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="blox-detail-grid">
      <div className="blox-detail-grid__main">{main}</div>
      <aside className="blox-detail-grid__aside">{aside}</aside>
    </div>
  );
}
