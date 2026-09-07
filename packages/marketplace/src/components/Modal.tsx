import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Small accessible dialog for confirmations and viewers: labelled by its
 * title, closes on Escape and backdrop click, moves focus in on open and back
 * to the opener on close, and locks body scroll while open. Styled with the
 * marketplace tokens so it reads the same on every customer page.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  tone = 'neutral',
  closeLabel,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'danger';
  /** Accessible name of the backdrop/close control. */
  closeLabel: string;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current;
    focusTarget?.focus({ preventScroll: true });
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`dm-modal dm-modal--${size} dm-modal--${tone}`} role="presentation">
      <button type="button" className="dm-modal__backdrop" aria-label={closeLabel} onClick={onClose} />
      <div
        ref={panelRef}
        className="dm-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="dm-modal__head">
          <h2 id={titleId} className="dm-modal__title">
            {title}
          </h2>
          <button type="button" className="dm-modal__close" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </div>
        {description ? (
          <p id={descId} className="dm-modal__desc">
            {description}
          </p>
        ) : null}
        {children ? <div className="dm-modal__body">{children}</div> : null}
        {footer ? <div className="dm-modal__foot">{footer}</div> : null}
      </div>
      <style>{MODAL_CSS}</style>
    </div>
  );
}

const MODAL_CSS = `
  .dm-modal {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 16px;
    box-sizing: border-box;
  }
  .dm-modal__backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(15, 23, 42, 0.5);
    cursor: pointer;
  }
  .dm-modal__panel {
    position: relative;
    width: min(100%, 460px);
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
    color: var(--dm-ink);
    outline: none;
  }
  .dm-modal--sm .dm-modal__panel { width: min(100%, 380px); }
  .dm-modal--lg .dm-modal__panel { width: min(100%, 760px); }
  .dm-modal--danger .dm-modal__panel { border-color: rgba(180, 35, 24, 0.35); }
  .dm-modal__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 20px 0;
  }
  .dm-modal__title {
    margin: 0;
    font-family: var(--dm-font-display);
    font-size: 1.15rem;
    line-height: 1.3;
  }
  .dm-modal--danger .dm-modal__title { color: var(--dm-danger, #b42318); }
  .dm-modal__close {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--dm-slate-200);
    background: transparent;
    font-size: 1.2rem;
    line-height: 1;
    color: var(--dm-slate-600);
    cursor: pointer;
  }
  .dm-modal__close:hover { background: var(--dm-canvas); color: var(--dm-ink); }
  .dm-modal__desc { margin: 10px 20px 0; font-size: 14px; line-height: 1.55; color: var(--dm-slate-600); }
  .dm-modal__body { padding: 14px 20px 0; overflow: auto; min-height: 0; }
  .dm-modal__foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    padding: 18px 20px 20px;
  }
  .dm-modal__foot .dm-btn-cta,
  .dm-modal__foot .dm-btn-ghost { min-height: 42px !important; padding: 0 18px !important; font-size: 0.9rem !important; }
  .dm-modal__pre {
    margin: 0;
    max-height: 50vh;
    overflow: auto;
    padding: 12px;
    border-radius: 10px;
    background: var(--dm-canvas);
    border: 1px solid var(--dm-slate-200);
    font-size: 12px;
    line-height: 1.45;
    direction: ltr;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .dm-modal__field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: var(--dm-slate-600); }
  .dm-modal__field textarea,
  .dm-modal__field input,
  .dm-modal__field select {
    width: 100%;
    box-sizing: border-box;
    min-height: 42px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--dm-slate-200);
    font: inherit;
    color: var(--dm-ink);
    background: var(--dm-surface);
  }
  .dm-modal__field textarea { min-height: 88px; resize: vertical; }
  .dm-modal__danger-btn {
    min-height: 42px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: var(--dm-danger, #b42318);
    color: #fff;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .dm-modal__danger-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  @media (max-width: 480px) {
    .dm-modal { padding: 0; align-items: end; }
    .dm-modal__panel { width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0; }
    .dm-modal__foot { flex-direction: column-reverse; }
    .dm-modal__foot > * { width: 100%; }
  }
`;
