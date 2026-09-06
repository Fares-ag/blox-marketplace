import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ops-core';
import { OpsField } from './OpsField';
import { apiFetch } from '../lib/api';
import type { AdminUserProvision } from '../types/domain';

type SetPasswordDialogProps = {
  open: boolean;
  userId: string | null;
  userEmail: string;
  title: string;
  message: string;
  customPasswordLabel: string;
  customPasswordHint: string;
  sendEmailLabel: string;
  generateLabel: string;
  submitLabel: string;
  cancelLabel: string;
  savingLabel: string;
  onClose: () => void;
  onSuccess: (account: AdminUserProvision) => void;
};

export function SetPasswordDialog({
  open,
  userId,
  userEmail,
  title,
  message,
  customPasswordLabel,
  customPasswordHint,
  sendEmailLabel,
  generateLabel,
  submitLabel,
  cancelLabel,
  savingLabel,
  onClose,
  onSuccess,
}: SetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setAutoGenerate(true);
    setSendEmail(true);
    setError(null);
    setPending(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('input,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setPending(true);
    try {
      const account = await apiFetch<AdminUserProvision>(`/api/users/${userId}/set-password`, {
        method: 'POST',
        body: JSON.stringify({
          password: autoGenerate ? undefined : password.trim() || undefined,
          sendEmail,
        }),
      });
      onSuccess(account);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="blox-ops blox-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className="blox-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 id={titleId} className="blox-dialog__title">
          {title}
        </h3>
        <p className="blox-dialog__message">{message.replace('{{email}}', userEmail)}</p>
        <form className="blox-dialog__body blox-form" onSubmit={onSubmit}>
          <label className="blox-checkbox-row">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
            />
            {generateLabel}
          </label>
          {!autoGenerate && (
            <OpsField
              label={customPasswordLabel}
              hint={customPasswordHint}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
            />
          )}
          <label className="blox-checkbox-row">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            {sendEmailLabel}
          </label>
          {error && (
            <p className="blox-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="blox-dialog__actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant="primary" disabled={pending || (!autoGenerate && password.length < 12)}>
              {pending ? savingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
