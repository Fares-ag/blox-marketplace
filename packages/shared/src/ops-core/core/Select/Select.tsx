import React from 'react';
import {
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import type { SelectProps as MuiSelectProps } from '@mui/material';
import './Select.scss';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<MuiSelectProps, 'variant'> {
  options: SelectOption[];
  error?: boolean;
  helperText?: string;
  variant?: 'outlined' | 'filled' | 'standard';
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  label,
  error,
  helperText,
  variant = 'outlined',
  className = '',
  fullWidth = true,
  placeholder,
  id,
  labelId,
  ...props
}) => {
  const reactId = React.useId();
  const resolvedId = id ?? `select-${reactId}`;
  const resolvedLabelId = labelId ?? `select-label-${reactId}`;

  return (
    <FormControl
      className={`custom-select ${className}`}
      fullWidth={fullWidth}
      error={error}
      variant={variant}
    >
      {label && (
        <InputLabel
          id={resolvedLabelId}
          htmlFor={resolvedId}
          shrink
          sx={{
            color: 'var(--field-lable-color)',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            transform: 'translate(14px, 14px) scale(1)',
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, -9px) scale(0.85)',
            },
            '&.Mui-focused': {
              color: 'var(--field-lable-color)',
            },
            '&.Mui-error': {
              color: 'var(--blox-black)',
            },
          }}
        >
          {label}
        </InputLabel>
      )}
      <MuiSelect
        id={resolvedId}
        labelId={resolvedLabelId}
        label={label}
        displayEmpty
        renderValue={(selected: unknown) => {
          if (selected === '' || selected === null || selected === undefined) {
            return <span style={{ color: 'var(--field-placeholder)' }}>{placeholder || 'Select an option'}</span>;
          }
          const selectedOption = options.find(opt => String(opt.value) === String(selected));
          return selectedOption ? selectedOption.label : String(selected);
        }}
        {...props}
        sx={{
          height: '48px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--card-background)',
          transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--field-border-color)',
            borderWidth: '1px',
          },
          '&:hover': {
            backgroundColor: 'var(--card-background)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--field-border-hover)',
              borderWidth: '1px',
            },
          },
          '&.Mui-focused': {
            backgroundColor: 'var(--card-background)',
            boxShadow: 'var(--field-focus-ring)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--field-border-focus)',
              borderWidth: '2px',
            },
          },
          '&.Mui-error': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--blox-black)',
              borderWidth: '1px',
            },
          },
          '&.Mui-disabled': {
            backgroundColor: 'var(--disabled-bg)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--field-border-color)',
            },
          },
          '& .MuiSelect-select': {
            padding: `0 var(--spacing-md)`,
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'var(--primary-text)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
          },
          '& .MuiSelect-icon': {
            color: 'var(--secondary-text)',
            right: 'var(--spacing-md)',
          },
        }}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {helperText && (
        <FormHelperText
          sx={{
            fontSize: '12px',
            marginTop: '6px',
            marginLeft: '0',
            color: error ? 'var(--blox-black)' : 'var(--secondary-text)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
          }}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};
