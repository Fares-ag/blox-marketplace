import React from 'react';
import { Button } from '../../core/Button/Button';
import { exportToCSV, exportToJSON } from '../../utils/export';

interface ExportButtonProps {
  data: any[];
  filename: string;
  onExport?: (format: 'csv' | 'json') => void;
  /** Formats to offer; defaults to CSV only (JSON is rarely what ops staff want). */
  formats?: Array<'csv' | 'json'>;
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M8 2v8m-3.5-3L8 10.5 11.5 7M3 13h10" />
    </svg>
  );
}

/** Export control — no MUI (Phase 2). One button per format; no menu to open first. */
export const ExportButton: React.FC<ExportButtonProps> = ({ data, filename, onExport, formats = ['csv'] }) => {
  const run = (format: 'csv' | 'json') => {
    if (format === 'csv') exportToCSV(data, filename);
    else exportToJSON(data, filename);
    onExport?.(format);
  };
  return (
    <span className="blox-export">
      {formats.map((format) => (
        <Button key={format} variant="secondary" size="sm" startIcon={<DownloadIcon />} onClick={() => run(format)} disabled={!data?.length}>
          {format === 'csv' ? 'Export CSV' : 'Export JSON'}
        </Button>
      ))}
    </span>
  );
};
