import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import { Button } from '../../core/Button/Button';
import './ConfirmDialog.scss';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  /** Optional form controls rendered under the message (e.g. a required reason). */
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
  children,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      className={`confirm-dialog ${variant}`}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" className="dialog-message">
          {message}
        </Typography>
        {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          className={variant === 'danger' ? 'danger-button' : ''}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
