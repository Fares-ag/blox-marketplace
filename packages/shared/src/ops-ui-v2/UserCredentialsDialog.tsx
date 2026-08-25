import { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from '@mui/material';
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

  async function copyAll() {
    if (!account) return;
    await navigator.clipboard.writeText(formatAccountDetails(account));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {account && (
          <div className="blox-form" style={{ marginTop: 8 }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.85 }}>{hint}</p>
            <label>
              Email
              <input readOnly value={account.email} />
            </label>
            <label>
              {passwordLabel}
              <input readOnly value={account.temporary_password} />
            </label>
            <label>
              {loginUrlLabel}
              <input readOnly value={account.login_url} />
            </label>
            {account.company_name && (
              <label>
                Company
                <input readOnly value={account.company_name} />
              </label>
            )}
            <label>
              Role
              <input readOnly value={account.role} />
            </label>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={copyAll} color="primary" disabled={!account}>
          {copied ? copiedLabel : copyAllLabel}
        </Button>
        <Button onClick={onClose} variant="contained">
          {closeLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
