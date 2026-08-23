import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Checkbox,
  FormControlLabel,
  Slider,
} from '@mui/material';
import { ExpandMore, Clear } from '@mui/icons-material';
import { Button } from '../../core/Button/Button';
import { Input } from '../../core/Input/Input';
import { Select, type SelectOption } from '../../core/Select/Select';
import { DatePicker } from '../../core/DatePicker/DatePicker';
import './FilterPanel.scss';

export interface FilterConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'range' | 'checkbox';
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onClear?: () => void;
  title?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  values,
  onChange,
  onClear,
  title = 'Filters',
}) => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleFilterChange = (filterId: string, value: any) => {
    onChange({ ...values, [filterId]: value });
  };

  const handleClearFilter = (filterId: string) => {
    const newValues = { ...values };
    delete newValues[filterId];
    onChange(newValues);
  };

  const getActiveFiltersCount = () => {
    return Object.keys(values).filter((key) => {
      const value = values[key];
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.values(value).some((entry) => entry !== null && entry !== undefined && entry !== '');
      }
      return true;
    }).length;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Box className="filter-panel">
      <Accordion expanded={expanded === 'filters'} onChange={(_, isExpanded) => setExpanded(isExpanded ? 'filters' : false)}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h4">
            {title} {activeFiltersCount > 0 && <Chip label={activeFiltersCount} size="small" />}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box className="filter-content">
            {filters.map((filter) => {
              const filterValue = values[filter.id];

              return (
                <Box key={filter.id} className="filter-item">
                  {filter.type !== 'checkbox' && (
                    <Box className="filter-header">
                      <Typography variant="body2" className="filter-label">
                        {filter.label}
                      </Typography>
                      {filterValue !== undefined && filterValue !== null && filterValue !== '' && filterValue !== false && (
                        <Chip
                          icon={<Clear />}
                          label="Clear"
                          size="small"
                          onClick={() => handleClearFilter(filter.id)}
                          className="clear-chip"
                        />
                      )}
                    </Box>
                  )}

                  {filter.type === 'text' && (
                    <Input
                      value={filterValue || ''}
                      onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                      placeholder={`Enter ${filter.label.toLowerCase()}`}
                    />
                  )}

                  {filter.type === 'select' && filter.options && (
                    <Select
                      value={filterValue || ''}
                      onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                      options={filter.options}
                      label={filter.label}
                    />
                  )}

                  {filter.type === 'multiselect' && filter.options && (
                    <Select
                      multiple
                      value={Array.isArray(filterValue) ? filterValue : []}
                      onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                      options={filter.options}
                      label={filter.label}
                    />
                  )}

                  {filter.type === 'date' && (
                    <DatePicker
                      value={filterValue || null}
                      onChange={(value) => handleFilterChange(filter.id, value)}
                      label={filter.label}
                    />
                  )}

                  {filter.type === 'daterange' && (
                    <Box className="date-range">
                      <DatePicker
                        value={filterValue?.startDate || null}
                        onChange={(value) =>
                          handleFilterChange(filter.id, {
                            ...filterValue,
                            startDate: value,
                          })
                        }
                        label="Start Date"
                      />
                      <DatePicker
                        value={filterValue?.endDate || null}
                        onChange={(value) =>
                          handleFilterChange(filter.id, {
                            ...filterValue,
                            endDate: value,
                          })
                        }
                        label="End Date"
                      />
                    </Box>
                  )}

                  {filter.type === 'range' && (
                    <Box className="range-slider">
                      <Slider
                        value={filterValue || [filter.min || 0, filter.max || 100]}
                        onChange={(_, newValue) => handleFilterChange(filter.id, newValue)}
                        min={filter.min || 0}
                        max={filter.max || 100}
                        step={filter.step || 1}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  )}

                  {filter.type === 'checkbox' && (
                    <FormControlLabel
                      className="filter-checkbox"
                      control={
                        <Checkbox
                          checked={Boolean(filterValue)}
                          onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
                        />
                      }
                      label={filter.label}
                    />
                  )}
                </Box>
              );
            })}

            {activeFiltersCount > 0 && onClear && (
              <Box className="filter-actions">
                <Button variant="secondary" onClick={onClear}>
                  Clear All Filters
                </Button>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
