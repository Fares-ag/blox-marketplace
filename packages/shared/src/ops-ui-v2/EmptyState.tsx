import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {body && (
        <Typography variant="body1" color="text.secondary">
          {body}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
