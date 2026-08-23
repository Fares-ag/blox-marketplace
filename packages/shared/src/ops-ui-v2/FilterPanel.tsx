import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  MenuItem,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export type FilterOption = { value: string; label: string };

export type FilterConfig = {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'range';
  options?: FilterOption[];
  min?: number;
  max?: number;
  step?: number;
};

export function FilterPanel({
  filters,
  values,
  onChange,
  onClear,
  title = 'More filters',
}: {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onClear?: () => void;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(values).filter((value) => {
    if (value == null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return Object.values(value as Record<string, unknown>).some((v) => v != null && v !== '');
    }
    return true;
  }).length;

  function setFilter(id: string, value: unknown) {
    onChange({ ...values, [id]: value });
  }

  return (
    <Accordion expanded={expanded} onChange={(_, next) => setExpanded(next)}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="h4">
          {title} {activeCount > 0 && <Chip label={activeCount} size="small" sx={{ ml: 1 }} />}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {filters.map((filter) => {
            const value = values[filter.id];
            if (filter.type === 'text') {
              return (
                <TextField
                  key={filter.id}
                  size="small"
                  label={filter.label}
                  value={(value as string) ?? ''}
                  onChange={(e) => setFilter(filter.id, e.target.value)}
                />
              );
            }
            if (filter.type === 'select') {
              return (
                <TextField
                  key={filter.id}
                  size="small"
                  select
                  label={filter.label}
                  value={(value as string) ?? ''}
                  onChange={(e) => setFilter(filter.id, e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {(filter.options ?? []).map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }
            if (filter.type === 'daterange') {
              const range = (value as { startDate?: string; endDate?: string }) ?? {};
              return (
                <Box key={filter.id} sx={{ display: 'grid', gap: 1 }}>
                  <TextField
                    size="small"
                    type="date"
                    label={`${filter.label} from`}
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={range.startDate ?? ''}
                    onChange={(e) => setFilter(filter.id, { ...range, startDate: e.target.value })}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label={`${filter.label} to`}
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={range.endDate ?? ''}
                    onChange={(e) => setFilter(filter.id, { ...range, endDate: e.target.value })}
                  />
                </Box>
              );
            }
            if (filter.type === 'range') {
              return (
                <Box key={filter.id}>
                  <Typography variant="body2">{filter.label}</Typography>
                  <Slider
                    value={(value as number[]) ?? [filter.min ?? 0, filter.max ?? 100]}
                    onChange={(_, next) => setFilter(filter.id, next)}
                    min={filter.min ?? 0}
                    max={filter.max ?? 100}
                    step={filter.step ?? 1}
                    valueLabelDisplay="auto"
                  />
                </Box>
              );
            }
            return null;
          })}
        </Box>
        {activeCount > 0 && onClear && (
          <Button sx={{ mt: 2 }} onClick={onClear}>
            Clear all filters
          </Button>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
