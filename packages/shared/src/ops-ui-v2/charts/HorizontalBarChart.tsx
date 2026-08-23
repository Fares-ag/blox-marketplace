import { Box, LinearProgress, Typography } from '@mui/material';
import { chartColors } from '../../config/chart-palette';

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
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        {showValue && (
          <Typography variant="body2" color="text.secondary">
            {percentage.toFixed(1)}%
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 20,
          borderRadius: '4px',
          backgroundColor: chartColors.track,
          '& .MuiLinearProgress-bar': {
            borderRadius: '4px',
            backgroundColor: color,
          },
        }}
      />
    </Box>
  );
}

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
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', height: 24, borderRadius: '4px', overflow: 'hidden', background: chartColors.track }}>
        {segmentPercentages.map((segment, index) => (
          <Box
            key={`${segment.label}-${index}`}
            sx={{
              width: `${segment.percentage}%`,
              backgroundColor: segment.color,
              minWidth: segment.percentage > 0 ? 4 : 0,
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
        {segmentPercentages.map((segment, index) => (
          <Typography key={`${segment.label}-legend-${index}`} variant="body2" sx={{ color: segment.color }}>
            {segment.percentage.toFixed(1)}% {segment.label}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
