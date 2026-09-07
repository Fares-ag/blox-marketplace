import { bloxTokens } from '../../config/blox-tokens';
import { chartColors } from '../../config/chart-palette';

const tooltipDefaults = {
  backgroundColor: bloxTokens.deepGreen,
  titleColor: '#fff',
  bodyColor: '#fff',
  borderColor: chartColors.emerald,
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
};

const axisDefaults = {
  x: {
    grid: { display: false },
    ticks: { color: bloxTokens.slate, font: { size: 11 } },
    border: { display: false },
  },
  y: {
    beginAtZero: true,
    grid: { color: 'rgba(22, 83, 91, 0.08)', drawBorder: false },
    ticks: { color: bloxTokens.slate, font: { size: 11 } },
    border: { display: false },
  },
};

export const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: tooltipDefaults,
  },
};

export const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  borderRadius: 6,
  borderSkipped: false as const,
  barPercentage: 0.65,
  categoryPercentage: 0.8,
  plugins: {
    legend: { display: false },
    tooltip: tooltipDefaults,
  },
  scales: axisDefaults,
};

export const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
      position: 'bottom' as const,
      labels: { color: bloxTokens.ink, boxWidth: 12, font: { size: 11 } },
    },
    tooltip: tooltipDefaults,
  },
  scales: axisDefaults,
};
