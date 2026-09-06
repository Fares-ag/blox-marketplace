import { chartColors } from '../../config/chart-palette';

/** Single horizontal bar with a label and percentage — no MUI (Phase 2). */
export function HorizontalBarChart({
  label,
  value,
  maxValue = 100,
  color = chartColors.emerald,
  showValue = true,
}: {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  showValue?: boolean;
}) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className="blox-hbar">
      <div className="blox-hbar__head">
        <span className="blox-hbar__label">{label}</span>
        {showValue && <span className="blox-hbar__value">{percentage.toFixed(1)}%</span>}
      </div>
      <div className="blox-hbar__track" role="img" aria-label={`${label} ${percentage.toFixed(1)}%`}>
        <span className="blox-hbar__fill" style={{ width: `${percentage}%`, background: color }} />
      </div>
    </div>
  );
}

/** Stacked segments summing to a total, with a legend — no MUI (Phase 2). */
export function SegmentedBarChart({
  label,
  segments,
  total,
}: {
  label: string;
  segments: Array<{ label: string; value: number; color: string }>;
  total?: number;
}) {
  const totalValue = total || segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  const segmentPercentages = segments.map((seg) => ({
    ...seg,
    percentage: (seg.value / totalValue) * 100,
  }));

  return (
    <div className="blox-hbar">
      <div className="blox-hbar__head">
        <span className="blox-hbar__label">{label}</span>
      </div>
      <div className="blox-hbar__track blox-hbar__track--stacked" role="img" aria-label={label}>
        {segmentPercentages.map((segment, index) => (
          <span
            key={`${segment.label}-${index}`}
            className="blox-hbar__segment"
            style={{ width: `${segment.percentage}%`, background: segment.color }}
          />
        ))}
      </div>
      <div className="blox-hbar__legend">
        {segmentPercentages.map((segment, index) => (
          <span key={`${segment.label}-legend-${index}`} className="blox-hbar__legend-item">
            <i className="blox-chart-legend__dot" style={{ background: segment.color }} />
            {segment.percentage.toFixed(1)}% {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}
