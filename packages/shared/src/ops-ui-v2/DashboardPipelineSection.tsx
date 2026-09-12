import { OpsStatCard } from '../components/ops-ui';
import { applicationCardTone, type OpsCardTone } from '../config/status-styles';

export type PipelineStat = {
  label: string;
  value: string;
  delta?: string;
  /** Application status key — tone is derived automatically when set. */
  status?: string;
  tone?: OpsCardTone;
};

export function DashboardPipelineSection({
  title,
  subtitle,
  stats,
  columns = 4,
}: {
  title: string;
  subtitle?: string;
  stats: PipelineStat[];
  columns?: 2 | 3 | 4;
}) {
  if (stats.length === 0) return null;
  const gridClass = columns === 2 ? 'blox-grid-2' : columns === 3 ? 'blox-grid-3' : 'blox-grid-4';

  return (
    <section className="blox-dashboard-section">
      <header className="blox-dashboard-card__head">
        <div>
          <h2 className="blox-panel__title">{title}</h2>
          {subtitle ? <p className="blox-dashboard-card__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className={gridClass}>
        {stats.map((stat) => (
          <OpsStatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            tone={stat.tone ?? (stat.status ? applicationCardTone(stat.status) : 'neutral')}
          />
        ))}
      </div>
    </section>
  );
}
