import React from 'react';
import { Button as MuiButton, CircularProgress } from '@mui/material';
import type { ButtonProps as MuiButtonProps } from '@mui/material';
import './Button.scss';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'secondary-neutral'
  | 'destructive'
  | 'tertiary'
  | 'outlined'
  | 'contained'
  | 'text'
  | 'icon'
  | 'small';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = React.memo(({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'btn-primary';
      case 'secondary':
        return 'btn-secondary';
      case 'secondary-neutral':
        return 'btn-secondary-neutral';
      case 'destructive':
        return 'btn-destructive';
      case 'tertiary':
        return 'btn-tertiary';
      case 'outlined':
        return 'btn-secondary-neutral';
      case 'contained':
        return 'btn-primary';
      case 'text':
        return 'btn-tertiary';
      case 'icon':
        return 'btn-icon';
      case 'small':
        return 'btn-small';
      default:
        return 'btn-primary';
    }
  };

  const isIconButton = variant === 'icon';

  return (
    <MuiButton
      className={`custom-button ${getVariantClass()} ${className}`}
      disabled={disabled || loading}
      {...props}
      sx={
        isIconButton
          ? {
              minWidth: '40px',
              width: '40px',
              height: '40px',
              padding: 0,
            }
          : undefined
      }
    >
      {loading ? (
        <CircularProgress size={20} color={variant === 'primary' ? 'inherit' : 'primary'} />
      ) : (
        children
      )}
    </MuiButton>
  );
}, (prevProps, nextProps) => {
  return prevProps.variant === nextProps.variant &&
         prevProps.loading === nextProps.loading &&
         prevProps.disabled === nextProps.disabled &&
         prevProps.children === nextProps.children &&
         prevProps.onClick === nextProps.onClick;
});
