import { Skeleton, TableSkeleton, CardSkeleton } from '../ops-core';

export function PageSkeleton({ variant = 'dashboard' }: { variant?: 'dashboard' | 'list' | 'detail' | 'form' }) {
  if (variant === 'list') {
    return (
      <div className="blox-list-section">
        <Skeleton variant="text" width={240} height={32} />
        <Skeleton variant="rectangular" width="100%" height={56} className="blox-skeleton-toolbar" />
        <TableSkeleton />
      </div>
    );
  }
  if (variant === 'detail') {
    return (
      <div className="blox-list-section">
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="text" width={320} height={32} />
        <div className="blox-detail-grid-skeleton">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }
  if (variant === 'form') {
    return (
      <div className="blox-list-section blox-form-skeleton">
        <Skeleton variant="text" width={280} height={32} />
        <CardSkeleton />
        <Skeleton variant="rectangular" width={160} height={44} />
      </div>
    );
  }
  return (
    <div className="blox-list-section">
      <Skeleton variant="text" width={240} height={32} />
      <Skeleton variant="text" width={360} height={20} />
      <div className="blox-metrics-grid">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="blox-detail-grid-skeleton">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
