import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  count?: number;
  animation?: 'pulse' | 'wave' | false;
  className?: string;
}

/** Shimmer placeholder — Phase 1 §05. Same geometry as the content it stands in for, so nothing shifts when data lands. */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  count = 1,
  animation = 'wave',
  className = '',
}) => {
  const style: React.CSSProperties = {
    width,
    height: height ?? (variant === 'text' ? '1em' : undefined),
  };
  const classes = [
    'blox-skel',
    `blox-skel--${variant}`,
    animation === false ? 'blox-skel--static' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (count === 1) return <span className={classes} style={style} aria-hidden />;

  return (
    <div className="blox-skel-stack">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className={classes} style={style} aria-hidden />
      ))}
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="blox-skel-table" aria-hidden>
      <div className="blox-skel-table__row blox-skel-table__row--header">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} height={12} width="60%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="blox-skel-table__row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height={12} width={colIndex === 0 ? '80%' : '55%'} />
          ))}
        </div>
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="blox-skel-card" aria-hidden>
          <Skeleton variant="text" width="40%" height={16} />
          <Skeleton variant="text" width="70%" height={12} />
          <Skeleton variant="text" width="55%" height={12} />
          <Skeleton variant="text" width="65%" height={12} />
        </div>
      ))}
    </>
  );
};
