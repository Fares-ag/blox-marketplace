import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Download, OpenInNew } from '@mui/icons-material';
import './PDFViewer.scss';

interface PDFViewerProps {
  url: string;
  title?: string;
  onClose?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, title }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box className="pdf-viewer">
      {title && (
        <Box className="pdf-viewer-header">
          <Typography variant="h5">{title}</Typography>
        </Box>
      )}

      <Box className="pdf-viewer-toolbar">
        <Box className="toolbar-left">
          <Typography variant="body2" className="pdf-viewer-note">
            Basic PDF preview
          </Typography>
        </Box>
        <Box className="toolbar-right">
          <IconButton onClick={handleOpen} size="small" title="Open in new tab">
            <OpenInNew />
          </IconButton>
          <IconButton onClick={handleDownload} size="small" title="Download">
            <Download />
          </IconButton>
        </Box>
      </Box>

      <Box className="pdf-viewer-content">
        <iframe
          src={url}
          title={title || 'PDF document'}
          className="pdf-viewer-frame"
        />
      </Box>
    </Box>
  );
};
