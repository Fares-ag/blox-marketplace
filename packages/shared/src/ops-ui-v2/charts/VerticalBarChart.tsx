import { Box, Typography } from '@mui/material';
import { chartColorAt, chartColors } from '../../config/chart-palette';

export type VerticalBar = {
  label: string;
  value: number;
  color?: string;
};

export function VerticalBarChart({
  title,
  bars,
  maxValue,
}: {
  title?: string;
  bars: VerticalBar[];
  maxValue?: number;
}) {
  const calculatedMax = maxValue || Math.max(...bars.map((bar) => bar.value), 1);
  const maxBarHeight = 150;

  return (
    <Box>
      {title && (
        <Typography variant="h4" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: 1,
          minHeight: maxBarHeight + 48,
        }}
      >
        {bars.map((bar, index) => {
          const height = calculatedMax > 0 ? (bar.value / calculatedMax) * maxBarHeight : 0;
          const color = bar.color ?? chartColorAt(index);
          return (
            <Box key={bar.label} sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <Box sx={{ height: maxBarHeight, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <Box
                  sx={{
                    width: '70%',
                    maxWidth: 48,
                    height: `${height}px`,
                    backgroundColor: bar.value > 0 ? color : chartColors.track,
                    minHeight: bar.value > 0 ? 8 : 0,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                {bar.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {bar.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
