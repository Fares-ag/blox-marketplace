import React, { useState } from 'react';
import { Button } from '../../core/Button/Button';
import { Menu, MenuItem } from '@mui/material';
import { GetApp, FileDownload } from '@mui/icons-material';
import { exportToCSV, exportToJSON } from '../../utils/export';
import './ExportButton.scss';

interface ExportButtonProps {
  data: any[];
  filename: string;
  onExport?: (format: 'csv' | 'json') => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ data, filename, onExport }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToJSON(data, filename);
    }
    onExport?.(format);
    handleClose();
  };

  return (
    <>
      <Button
        variant="secondary"
        startIcon={<GetApp />}
        onClick={handleClick}
        className="export-button"
      >
        Export
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleExport('csv')}>
          <FileDownload sx={{ mr: 1 }} />
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          <FileDownload sx={{ mr: 1 }} />
          Export as JSON
        </MenuItem>
      </Menu>
    </>
  );
};
