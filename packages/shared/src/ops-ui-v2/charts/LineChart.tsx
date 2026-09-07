import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { bloxTokens } from '../../config/blox-tokens';
import { lineChartOptions } from './chartDefaults';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export type LineChartSeries = {
  label: string;
  data: number[];
  color?: string;
};

export function LineChart({
  labels,
  series,
  height = 240,
}: {
  labels: string[];
  series: LineChartSeries[];
  height?: number;
}) {
  if (!labels.length || !series.length) {
    return <p style={{ margin: 0, color: 'var(--blox-slate)', fontSize: '0.875rem' }}>No data</p>;
  }

  return (
    <div style={{ height, position: 'relative' }}>
      <Line
        data={{
          labels,
          datasets: series.map((s) => ({
            label: s.label,
            data: s.data,
            borderColor: s.color ?? bloxTokens.emerald,
            backgroundColor: `${s.color ?? bloxTokens.emerald}33`,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          })),
        }}
        options={{
          ...lineChartOptions,
          maintainAspectRatio: false,
          plugins: {
            ...lineChartOptions.plugins,
            legend: {
              ...lineChartOptions.plugins?.legend,
              display: series.length > 1,
            },
          },
        }}
      />
    </div>
  );
}
