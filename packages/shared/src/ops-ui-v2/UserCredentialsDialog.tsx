import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ops-core';
import { OpsField } from './OpsField';
import type { AdminUserProvision } from '../types/domain';

type UserCredentialsDialogProps = {
  open: boolean;
  account: AdminUserProvision | null;
  title: string;
  hint: string;
  passwordLabel: string;
  loginUrlLabel: string;
  copyAllLabel: string;
  copiedLabel: string;
  closeLabel?: string;
  onClose: () => void;
};

function formatAccountDetails(account: AdminUserProvision): string {
  return [
    `Email: ${account.email}`,
    `Password: ${account.temporary_password}`,
    `Sign-in: ${account.login_url}`,
    account.company_name ? `Company: ${account.company_name}` : null,
    `Role: ${account.role}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Shows freshly provisioned credentials once, with copy-all — no MUI (Phase 2). */
export function UserCredentialsDialog({
  open,
  account,
  title,
  hint,
  passwordLabel,
  loginUrlLabel,
  copyAllLabel,
  copiedLabel,
  closeLabel = 'Close',
  onClose,
}: UserCredentialsDialogProps) {
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function copyAll() {
    if (!account) return;
    await navigator.clipboard.writeText(formatAccountDetails(account));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="blox-ops blox-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className="blox-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 id={titleId} className="blox-dialog__title">
          {title}
        </h3>
        <p className="blox-dialog__message">{hint}</p>
        {account && (
          <div className="blox-dialog__body">
            <OpsField label="Email" readOnly value={account.email} mono />
            <OpsField label={passwordLabel} readOnly value={account.temporary_password} mono />
            <OpsField label={loginUrlLabel} readOnly value={account.login_url} mono />
            {account.company_name && <OpsField label="Company" readOnly value={account.company_name} />}
            <OpsField label="Role" readOnly value={account.role} />
          </div>
        )}
        <div className="blox-dialog__actions">
          <Button variant="secondary" onClick={copyAll} disabled={!account}>
            {copied ? copiedLabel : copyAllLabel}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
