import type { ReactNode } from 'react';

export function ChartPanel({
  title,
  children,
  legend,
}: {
  title: string;
  children: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <section className="blox-detail-section blox-chart-panel">
      <h2 className="blox-panel__title">{title}</h2>
      <div className="blox-chart-panel__body">{children}</div>
      {legend && <div className="blox-chart-legend">{legend}</div>}
    </section>
  );
}

export function ChartLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="blox-chart-legend__item">
      <span className="blox-chart-legend__dot" style={{ background: color }} />
      {label}
    </div>
  );
}

export function ChartPanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="blox-chart__title">{children}</h3>;
}
