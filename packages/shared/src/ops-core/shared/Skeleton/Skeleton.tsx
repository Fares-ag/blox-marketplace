import React from 'react';
import { Box, Skeleton as MuiSkeleton } from '@mui/material';
import './Skeleton.scss';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  count?: number;
  animation?: 'pulse' | 'wave' | false;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  count = 1,
  animation = 'wave',
  className = '',
}) => {
  if (count === 1) {
    return (
      <MuiSkeleton
        variant={variant}
        width={width}
        height={height}
        animation={animation}
        className={`custom-skeleton ${className}`}
      />
    );
  }

  return (
    <Box className={`skeleton-container ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <MuiSkeleton
          key={index}
          variant={variant}
          width={width}
          height={height}
          animation={animation}
          className="custom-skeleton"
          sx={{ mb: index < count - 1 ? 1 : 0 }}
        />
      ))}
    </Box>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <Box className="table-skeleton">
      <Box className="skeleton-header">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} height={40} width="100%" variant="rectangular" />
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} className="skeleton-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height={50} width="100%" variant="rectangular" />
          ))}
        </Box>
      ))}
    </Box>
  );
};

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} className="card-skeleton">
          <Skeleton variant="rectangular" height={200} width="100%" />
          <Box sx={{ p: 2 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
            <Skeleton variant="text" width="80%" height={20} />
          </Box>
        </Box>
      ))}
    </>
  );
};
