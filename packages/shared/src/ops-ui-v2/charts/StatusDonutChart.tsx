import { Doughnut } from 'react-chartjs-2';
import { applicationChartColor } from '../../config/chart-palette';
import { doughnutChartOptions } from './chartDefaults';

export type StatusDonutSegment = {
  status: string;
  label: string;
  value: number;
};

/** Donut with semantic status colors, center total, and a readable legend. */
export function StatusDonutChart({
  segments,
  emptyLabel = '—',
  totalLabel = 'Total',
}: {
  segments: StatusDonutSegment[];
  emptyLabel?: string;
  totalLabel?: string;
}) {
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const visible = sorted.filter((s) => s.value > 0);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="blox-muted">{emptyLabel}</p>;
  }

  return (
    <div className="blox-donut-chart">
      <div className="blox-donut-chart__ring">
        <Doughnut
          data={{
            labels: visible.map((s) => s.label),
            datasets: [
              {
                data: visible.map((s) => s.value),
                backgroundColor: visible.map((s) => applicationChartColor(s.status)),
                borderWidth: 2,
                borderColor: '#fff',
              },
            ],
          }}
          options={doughnutChartOptions}
        />
        <div className="blox-donut-chart__total" aria-hidden>
          <span className="blox-donut-chart__total-value">{total.toLocaleString()}</span>
          <span className="blox-donut-chart__total-label">{totalLabel}</span>
        </div>
      </div>
      <ul className="blox-donut-chart__legend">
        {sorted.map((s) => (
          <li key={s.status} className={s.value === 0 ? 'is-zero' : undefined}>
            <span className="blox-donut-chart__swatch" style={{ background: applicationChartColor(s.status) }} aria-hidden />
            <span className="blox-donut-chart__legend-label" title={s.label}>
              {s.label}
            </span>
            <span className="blox-donut-chart__legend-value">{s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
