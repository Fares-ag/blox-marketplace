import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

export type OpsMetricItem = {
  label: string;
  value: string;
  delta?: string;
  /** Colours the delta and adds a trend arrow. */
  deltaTone?: 'up' | 'down' | 'neutral';
  /** Small series (e.g. the last 8 weeks) drawn as a sparkline under the value. */
  trend?: number[];
  icon?: ReactNode;
};

/** 96×28 sparkline with an area fill and an emphasised last point. Draws to the series' own scale. */
export function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  const w = 96;
  const h = 28;
  const pad = 2;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className={`blox-sparkline ${className}`.trim()} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <path d={area} className="blox-sparkline__area" />
      <path d={line} className="blox-sparkline__line" fill="none" />
      <circle cx={lx} cy={ly} r="2.5" className="blox-sparkline__end" />
    </svg>
  );
}

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
          <div className="blox-metric-card__row">
            <p className="blox-metric-card__value blox-money">{m.value}</p>
            {m.trend && m.trend.length > 1 && <Sparkline values={m.trend} />}
          </div>
          {m.delta && (
            <p className={`blox-metric-card__delta${m.deltaTone ? ` blox-metric-card__delta--${m.deltaTone}` : ''}`}>
              {m.deltaTone === 'up' && <TrendingUp size={13} strokeWidth={2} aria-hidden />}
              {m.deltaTone === 'down' && <TrendingDown size={13} strokeWidth={2} aria-hidden />}
              {m.delta}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
