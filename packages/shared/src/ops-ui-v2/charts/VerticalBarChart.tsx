import { chartColorAt, chartColors } from '../../config/chart-palette';

export type VerticalBar = {
  label: string;
  value: number;
  color?: string;
};

const DEFAULT_PLOT_HEIGHT = 200;
const MIN_VISIBLE_BAR = 5;

/** Column chart with a shared baseline — values align on one row, bars scale to one max. */
export function VerticalBarChart({
  title,
  bars,
  maxValue,
  plotHeight = DEFAULT_PLOT_HEIGHT,
}: {
  title?: string;
  bars: VerticalBar[];
  maxValue?: number;
  plotHeight?: number;
}) {
  const calculatedMax = maxValue ?? Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="blox-vbar">
      {title && <h3 className="blox-chart__title">{title}</h3>}
      <div className="blox-vbar__plot" role="img" aria-label={title ?? 'Bar chart'}>
        {bars.map((bar, index) => {
          const ratio = calculatedMax > 0 ? bar.value / calculatedMax : 0;
          const barHeight =
            bar.value > 0 ? Math.max(Math.round(ratio * plotHeight), MIN_VISIBLE_BAR) : 0;
          const color = bar.color ?? chartColorAt(index);
          return (
            <div key={bar.label} className="blox-vbar__col">
              <span className="blox-vbar__value">{bar.value.toLocaleString()}</span>
              <div className="blox-vbar__stem" style={{ height: plotHeight }}>
                <span className="blox-vbar__track" aria-hidden />
                <span
                  className="blox-vbar__bar"
                  style={{ height: barHeight, background: bar.value > 0 ? color : chartColors.track }}
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
