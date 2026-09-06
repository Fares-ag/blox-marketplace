import { chartColorAt, chartColors } from '../../config/chart-palette';

export type VerticalBar = {
  label: string;
  value: number;
  color?: string;
};

/** Column chart drawn to one scale — no MUI (Phase 2). Values sit above bars, labels below. */
export function VerticalBarChart({
  title,
  bars,
  maxValue,
}: {
  title?: string;
  bars: VerticalBar[];
  maxValue?: number;
}) {
  const calculatedMax = maxValue || Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="blox-vbar">
      {title && <h3 className="blox-chart__title">{title}</h3>}
      <div className="blox-vbar__plot" role="img" aria-label={title ?? 'Bar chart'}>
        {bars.map((bar, index) => {
          const pct = calculatedMax > 0 ? (bar.value / calculatedMax) * 100 : 0;
          const color = bar.color ?? chartColorAt(index);
          return (
            <div key={bar.label} className="blox-vbar__col">
              <span className="blox-vbar__value">{bar.value.toLocaleString()}</span>
              <div className="blox-vbar__stem">
                <span
                  className="blox-vbar__bar"
                  style={{ height: `${pct}%`, background: bar.value > 0 ? color : chartColors.track }}
                />
              </div>
              <span className="blox-vbar__label" title={bar.label}>
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
