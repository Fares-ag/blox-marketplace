import React from 'react';
import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import './Input.scss';

export interface InputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
}

const fieldFocusSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
    '& fieldset': {
      borderColor: 'var(--field-border-color)',
    },
    '&:hover fieldset': {
      borderColor: 'var(--field-border-hover)',
    },
    '&.Mui-focused': {
      boxShadow: 'var(--field-focus-ring)',
      '& fieldset': {
        borderColor: 'var(--field-border-focus)',
        borderWidth: '2px',
      },
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--field-lable-color)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'var(--field-lable-color)',
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'var(--field-placeholder)',
    opacity: 1,
  },
};

export const Input: React.FC<InputProps> = React.memo(({
  variant = 'outlined',
  className = '',
  sx,
  ...props
}) => {
  const filledSx: SxProps<Theme> =
    variant === 'filled'
      ? {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'var(--disabled-bg)',
          },
        }
      : {};

  const mergedSx = (sx
    ? [fieldFocusSx, filledSx, sx as SxProps<Theme>]
    : [fieldFocusSx, filledSx]) as SxProps<Theme>;

  return (
    <TextField
      className={`custom-input ${className}`}
      variant={variant}
      fullWidth
      {...props}
      sx={mergedSx}
      aria-label={String(props.label ?? props.placeholder ?? props.name ?? 'Input field')}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value &&
         prevProps.variant === nextProps.variant &&
         prevProps.disabled === nextProps.disabled &&
         prevProps.error === nextProps.error;
});
