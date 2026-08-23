import React from 'react';
import { Input } from '../../core/Input/Input';
import { Search } from '@mui/icons-material';
import { Box, IconButton, InputAdornment } from '@mui/material';
import './SearchBar.scss';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  onSearch,
  className = '',
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <Box className={`search-bar ${className}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        fullWidth
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'var(--card-background)',
          },
          '& .MuiInputBase-input::placeholder': {
            color: 'var(--field-placeholder)',
            opacity: 1,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconButton
                  size="small"
                  onClick={() => onSearch?.(value)}
                  className="search-icon"
                  aria-label="Search"
                  title="Search"
                >
                  <Search />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
};
