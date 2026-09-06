import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../core/Button/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  /** Optional form controls rendered under the message (e.g. a required reason). */
  children?: React.ReactNode;
  /** Disables the confirm button (e.g. a required reason is still empty). */
  confirmDisabled?: boolean;
  /** Shows the spinner on the confirm button while the mutation runs. */
  busy?: boolean;
}

/**
 * Confirm dialog — Phase 1 §08. No MUI: a portaled scrim + panel with Esc/scrim dismissal,
 * initial focus on the first control and focus restoration on close.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
  children,
  confirmDisabled,
  busy,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'textarea, input:not([type="hidden"]), select, button',
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onCancel, busy]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="blox-ops blox-dialog-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className={`blox-dialog blox-dialog--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId} className="blox-dialog__title">
          {title}
        </h3>
        <p className="blox-dialog__message">{message}</p>
        {children ? <div className="blox-dialog__body">{children}</div> : null}
        <div className="blox-dialog__actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            solid={variant === 'danger'}
            onClick={onConfirm}
            disabled={confirmDisabled}
            loading={busy}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
