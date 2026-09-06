import { chartColorAt } from '../../config/chart-palette';

export type FunnelStage = {
  label: string;
  value: number;
  percentage?: number;
  dropOffRate?: number;
  color?: string;
};

/** Funnel as centred bars scaled to the top stage — no MUI (Phase 2). */
export function FunnelChart({
  title,
  stages,
  showValues = true,
  showPercentages = true,
}: {
  title?: string;
  stages: FunnelStage[];
  showValues?: boolean;
  showPercentages?: boolean;
}) {
  if (!stages.length) {
    return <p className="blox-chart__empty">—</p>;
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const top = stages[0]?.value || 1;

  return (
    <div className="blox-funnel">
      {title && <h3 className="blox-chart__title">{title}</h3>}
      <ol className="blox-funnel__stages">
        {stages.map((stage, index) => {
          const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const percentage = stage.percentage ?? (top > 0 ? (stage.value / top) * 100 : 0);
          const color = stage.color ?? chartColorAt(index);
          return (
            <li key={stage.label} className="blox-funnel__stage">
              <div className="blox-funnel__head">
                <span className="blox-funnel__label">{stage.label}</span>
                <span className="blox-funnel__meta">
                  {showValues ? stage.value.toLocaleString() : ''}
                  {showValues && showPercentages ? ' · ' : ''}
                  {showPercentages ? `${percentage.toFixed(1)}%` : ''}
                </span>
              </div>
              <span className="blox-funnel__bar" style={{ width: `${Math.max(widthPercentage, 8)}%`, background: color }} />
              {stage.dropOffRate !== undefined && stage.dropOffRate > 0 && index < stages.length - 1 && (
                <span className="blox-funnel__drop">-{stage.dropOffRate.toFixed(1)}%</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
