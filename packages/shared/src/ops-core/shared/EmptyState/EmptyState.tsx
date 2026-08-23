import React from 'react';
import { Box, Typography } from '@mui/material';
import { Inbox } from '@mui/icons-material';
import { Button } from '../../core/Button/Button';
import './EmptyState.scss';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data available',
  message = 'There is no data to display at the moment.',
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <Box className="empty-state">
      <Box className="empty-state-icon">
        {icon || <Inbox sx={{ fontSize: 64, color: 'var(--custom-text-color)' }} />}
      </Box>
      <Typography variant="h4" className="empty-state-title">
        {title}
      </Typography>
      <Typography variant="body2" className="empty-state-message">
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};
