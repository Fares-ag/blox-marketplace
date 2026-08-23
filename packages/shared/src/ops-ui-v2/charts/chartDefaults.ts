import { bloxTokens } from '../../config/blox-tokens';
import { chartColors } from '../../config/chart-palette';

export const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: bloxTokens.deepGreen,
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: chartColors.emerald,
      borderWidth: 1,
    },
  },
};
