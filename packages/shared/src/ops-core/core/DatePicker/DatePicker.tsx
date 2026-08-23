import React from 'react';
import type { TextFieldProps } from '@mui/material';
import { Input } from '../Input/Input';

export interface DatePickerProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'type'> {
  value: string | Date | null;
  onChange: (value: string | null) => void;
}

function toDateInputValue(value: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  ...props
}) => {
  return (
    <Input
      type="date"
      label={label}
      value={toDateInputValue(value)}
      onChange={(e) => onChange(e.target.value || null)}
      slotProps={{ inputLabel: { shrink: true } }}
      {...props}
    />
  );
};
