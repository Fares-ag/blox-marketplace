import { Box, Typography } from '@mui/material';
import { chartColorAt, chartColors } from '../../config/chart-palette';

export type FunnelStage = {
  label: string;
  value: number;
  percentage?: number;
  dropOffRate?: number;
  color?: string;
};

export function FunnelChart({
  title,
  stages,
  showValues = true,
  showPercentages = true,
}: {
  title?: string;
  stages: FunnelStage[];
  showValues?: boolean;
  showPercentages?: boolean;
}) {
  if (!stages.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const top = stages[0]?.value || 1;

  return (
    <Box>
      {title && (
        <Typography variant="h4" sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {stages.map((stage, index) => {
          const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const percentage = stage.percentage ?? (top > 0 ? (stage.value / top) * 100 : 0);
          const color = stage.color ?? chartColorAt(index);
          return (
            <Box key={stage.label}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stage.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {showValues ? stage.value.toLocaleString() : ''}
                  {showValues && showPercentages ? ' · ' : ''}
                  {showPercentages ? `${percentage.toFixed(1)}%` : ''}
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 28,
                  width: `${Math.max(widthPercentage, 8)}%`,
                  mx: 'auto',
                  backgroundColor: color,
                  borderRadius: '4px',
                  boxShadow: `inset 0 0 0 1px ${chartColors.border}`,
                }}
              />
              {stage.dropOffRate !== undefined && stage.dropOffRate > 0 && index < stages.length - 1 && (
                <Typography variant="caption" color="error">
                  -{stage.dropOffRate.toFixed(1)}%
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
