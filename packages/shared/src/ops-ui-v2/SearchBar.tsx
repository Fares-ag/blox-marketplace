import { TextField, InputAdornment } from '@mui/material';
import { Search } from '@mui/icons-material';

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
