import type { ReactNode } from 'react';
import { OpsStatCard } from '../components/ops-ui';

export type OpsMetricItem = {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
};

export function OpsMetricRow({
  metrics,
  children,
  heroIndex = 0,
}: {
  metrics?: OpsMetricItem[];
  children?: ReactNode;
  heroIndex?: number;
}) {
  if (children) {
    return <div className="blox-metrics-grid">{children}</div>;
  }
  return (
    <div className="blox-metrics-grid">
      {(metrics ?? []).map((m, i) => (
        <article key={m.label} className={`blox-metric-card${i === heroIndex ? ' blox-metric-card--hero' : ''}`}>
          {m.icon && <div className="blox-metric-card__icon">{m.icon}</div>}
          <p className="blox-metric-card__label">{m.label}</p>
          <p className="blox-metric-card__value blox-money">{m.value}</p>
          {m.delta && <p className="blox-metric-card__delta">{m.delta}</p>}
        </article>
      ))}
    </div>
  );
}
