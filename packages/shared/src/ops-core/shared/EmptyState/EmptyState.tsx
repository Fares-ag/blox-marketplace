import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../../core/Button/Button';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/** Empty region — Phase 1 §07: dashed border, emerald-soft glyph, one line of guidance, at most one action. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  message = 'There is no data to display at the moment.',
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="blox-empty" role="status">
      <div className="blox-empty__glyph">{icon ?? <Inbox size={20} strokeWidth={1.75} aria-hidden />}</div>
      <p className="blox-empty__title">{title}</p>
      {message && <p className="blox-empty__body">{message}</p>}
      {actionLabel && onAction && (
        <div className="blox-empty__action">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
