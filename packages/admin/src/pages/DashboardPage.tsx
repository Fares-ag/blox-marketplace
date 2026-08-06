import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { bloxTokens } from '@drivemarket/shared';
import { PageHeader, PrimaryButton, SecondaryButton, StatCard } from '../components/ui';

ChartJS.register(ArcElement, Tooltip, Legend);

const chartData = {
  labels: ['Paid', 'Unpaid'],
  datasets: [
    {
      data: [68, 32],
      backgroundColor: [bloxTokens.emerald, bloxTokens.slate],
      borderWidth: 0,
      hoverOffset: 4,
    },
  ],
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '68%',
  plugins: {
    legend: { display: false },
  },
};

export function DashboardPage() {
  return (
    <div className="blox-page">
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview and installment performance"
        actions={
          <>
            <input type="date" defaultValue="2026-01-01" aria-label="Start date" />
            <input type="date" defaultValue="2026-08-05" aria-label="End date" />
            <SecondaryButton>Apply range</SecondaryButton>
            <PrimaryButton>Export report</PrimaryButton>
          </>
        }
      />

      <div className="blox-stat-grid">
        <StatCard label="Projected Insurance" value="QAR 1.24M" delta="+4.2% vs last month" />
        <StatCard label="Funding" value="QAR 8.92M" delta="+12.1% vs last month" />
        <StatCard label="Revenue" value="QAR 2.18M" delta="+6.8% vs last month" />
        <StatCard label="Real Revenue" value="QAR 1.87M" delta="+3.4% vs last month" />
      </div>

      <div className="blox-chart-row">
        <section className="blox-panel">
          <h2 className="blox-panel__title">Paid vs unpaid installments</h2>
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <Doughnut data={chartData} options={chartOptions} />
          </div>
          <div className="blox-chart-legend">
            <div className="blox-chart-legend__item">
              <span className="blox-chart-legend__dot" style={{ background: bloxTokens.emerald }} />
              Paid — 68% (QAR 612,400)
            </div>
            <div className="blox-chart-legend__item">
              <span className="blox-chart-legend__dot" style={{ background: bloxTokens.slate }} />
              Unpaid — 32% (QAR 288,100)
            </div>
          </div>
        </section>

        <section className="blox-panel">
          <h2 className="blox-panel__title">Blox share</h2>
          <p className="blox-money" style={{ fontSize: '2.5rem', margin: '8px 0 4px' }}>
            14.5%
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--blox-slate)' }}>
            Average platform take across active contracts
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--blox-slate)' }}>Insurance margin</span>
              <span className="blox-money">8.2%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--blox-slate)' }}>Financing spread</span>
              <span className="blox-money">6.3%</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
