import { chartColorAt } from '../../config/chart-palette';

export type FunnelStage = {
  label: string;
  value: number;
  /** Share of the baseline stage (defaults to the first stage). Used for bar width and labels. */
  percentage?: number;
  dropOffRate?: number;
  color?: string;
};

/** Horizontal conversion funnel — bars left-aligned, scaled to the baseline stage (100%). */
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

  return (
    <div className="blox-funnel">
      {title && <h3 className="blox-chart__title">{title}</h3>}
      <ol className="blox-funnel__stages">
        {stages.map((stage, index) => {
          const percentage =
            stage.percentage ??
            (stages[0]!.value > 0 ? (stage.value / stages[0]!.value) * 100 : 0);
          const widthPercentage = Math.min(Math.max(percentage, stage.value > 0 ? 4 : 0), 100);
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
              <div className="blox-funnel__track" aria-hidden>
                <span
                  className="blox-funnel__bar"
                  style={{ width: `${widthPercentage}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
