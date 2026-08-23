import { useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import { FileDownload, GetApp } from '@mui/icons-material';
import { exportToCSV, exportToJSON } from './export';

export function ExportButton({
  data,
  filename,
  onExport,
}: {
  data: Record<string, unknown>[];
  filename: string;
  onExport?: (format: 'csv' | 'json') => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function handleExport(format: 'csv' | 'json') {
    if (format === 'csv') exportToCSV(data, filename);
    else exportToJSON(data, filename);
    onExport?.(format);
    setAnchor(null);
  }

  return (
    <>
      <Button variant="outlined" startIcon={<GetApp />} onClick={(e) => setAnchor(e.currentTarget)}>
        Export
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => handleExport('csv')}>
          <FileDownload sx={{ mr: 1 }} /> Export as CSV
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          <FileDownload sx={{ mr: 1 }} /> Export as JSON
        </MenuItem>
      </Menu>
    </>
  );
}
