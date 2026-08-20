import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { bloxMeta } from '../config/blox-tokens';
import { useAuthStore } from './auth-store';

function extractTotpSecret(totpURI: string): string | null {
  try {
    const url = new URL(totpURI);
    return url.searchParams.get('secret');
  } catch {
    const match = /[?&]secret=([^&]+)/i.exec(totpURI);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

interface MfaPageShellProps {
  portalLabel: string;
  title: string;
  lead: string;
  brandName?: string;
  tagline?: string;
  children: React.ReactNode;
}

function MfaPageShell({
  portalLabel,
  title,
  lead,
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
  children,
}: MfaPageShellProps) {
  return (
    <div className="dm-auth-layout">
      <aside className="dm-auth-brand" aria-label={`${brandName} brand`}>
        <div className="dm-auth-brand__media" role="img" aria-hidden />
        <div className="dm-auth-brand__scrim" />
        <div className="dm-auth-brand__content">
          <p className="dm-auth-brand__portal">{portalLabel}</p>
          <p className="dm-auth-brand__tag">{tagline}</p>
        </div>
      </aside>
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">{portalLabel}</p>
          <h1>{title}</h1>
          <p className="dm-auth-card__lead">{lead}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

interface TwoFactorLoginPageProps {
  portalLabel: string;
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

/** Second step after password sign-in when TOTP is enabled. */
export function TwoFactorLoginPage({
  portalLabel,
  homePath = '/',
  brandName,
  tagline,
}: TwoFactorLoginPageProps) {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifyTwoFactor = useAuthStore((s) => s.verifyTwoFactor);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await verifyTwoFactor(code, trustDevice);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(returnUrl ? decodeURIComponent(returnUrl) : homePath);
  }

  return (
    <MfaPageShell
      portalLabel={portalLabel}
      title="Two-factor verification"
      lead="Enter the 6-digit code from your authenticator app to finish signing in."
      brandName={brandName}
      tagline={tagline}
    >
      <form onSubmit={onSubmit} className="dm-auth-form">
        <label>
          Authenticator code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            placeholder="000000"
          />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
          />
          Trust this device for 30 days
        </label>
        {error && <p className="dm-auth-error">{error}</p>}
        <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={loading || code.length !== 6}>
          {loading ? 'Verifying…' : 'Verify and continue'}
        </button>
        <p className="dm-auth-foot">
          <Link to="/auth/login">Back to sign in</Link>
        </p>
      </form>
    </MfaPageShell>
  );
}

interface MfaSetupPageProps {
  portalLabel: string;
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

/** Mandatory TOTP enrollment for privileged ops roles. */
export function MfaSetupPage({
  portalLabel,
  homePath = '/',
  brandName,
  tagline,
}: MfaSetupPageProps) {
  const { user, initialized, init, loading, enableTwoFactor, verifyTwoFactorSetup, signOut } =
    useAuthStore();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'password' | 'verify'>('password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const manualSecret = useMemo(() => (totpURI ? extractTotpSecret(totpURI) : null), [totpURI]);

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized || loading) {
    return (
      <div style={{ padding: 48, fontFamily: 'var(--dm-font-ui)', color: 'var(--dm-slate-600)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!user.mfa_setup_required) {
    return <Navigate to={returnUrl ? decodeURIComponent(returnUrl) : homePath} replace />;
  }

  async function startSetup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await enableTwoFactor(password);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTotpURI(result.totpURI ?? null);
    setBackupCodes(result.backupCodes ?? []);
    setStep('verify');
  }

  async function confirmSetup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await verifyTwoFactorSetup(code);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(returnUrl ? decodeURIComponent(returnUrl) : homePath);
  }

  return (
    <MfaPageShell
      portalLabel={portalLabel}
      title="Set up two-factor authentication"
      lead="Privileged Blox accounts must use an authenticator app before accessing the portal."
      brandName={brandName}
      tagline={tagline}
    >
      {step === 'password' ? (
        <form onSubmit={startSetup} className="dm-auth-form">
          <label>
            Confirm your password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="dm-auth-error">{error}</p>}
          <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={loading}>
            {loading ? 'Preparing…' : 'Generate authenticator setup'}
          </button>
          <p className="dm-auth-foot">
            <button type="button" className="dm-auth-linkbtn" onClick={() => void signOut()}>
              Sign out
            </button>
          </p>
        </form>
      ) : (
        <>
          <div className="dm-auth-banner" role="status">
            <p>
              Scan this setup key in Google Authenticator, Authy, or another TOTP app.
              {manualSecret ? (
                <>
                  {' '}
                  Manual entry key: <strong>{manualSecret}</strong>
                </>
              ) : null}
            </p>
            {totpURI && (
              <p style={{ marginTop: 10, wordBreak: 'break-all', fontSize: '0.8rem' }}>{totpURI}</p>
            )}
          </div>
          {backupCodes.length > 0 && (
            <div className="dm-auth-banner" role="status" style={{ marginBottom: 16 }}>
              <p>Save these backup codes in a secure place. Each code can be used once.</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                {backupCodes.map((entry) => (
                  <li key={entry}>
                    <code>{entry}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={confirmSetup} className="dm-auth-form">
            <label>
              Enter the 6-digit code from your app
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
              />
            </label>
            {error && <p className="dm-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={loading || code.length !== 6}>
              {loading ? 'Enabling…' : 'Enable two-factor and continue'}
            </button>
          </form>
        </>
      )}
    </MfaPageShell>
  );
}

interface SecuritySettingsPanelProps {
  className?: string;
}

/** Logout-all-devices control for ops portals. */
export function SecuritySettingsPanel({ className }: SecuritySettingsPanelProps) {
  const { user, revokeAllSessions, signOut } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function onRevokeAll() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const confirmed = window.confirm(
      'This signs you out on every device, including this browser. Continue?',
    );
    if (!confirmed) {
      setBusy(false);
      return;
    }
    const result = await revokeAllSessions();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('All sessions revoked. Signing you out…');
    await signOut();
    window.location.assign('/auth/login?reason=session_expired');
  }

  return (
    <section className={className} style={{ marginTop: 24 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Security</h2>
      <p style={{ margin: '0 0 12px', color: 'var(--dm-slate-600)', fontSize: '0.92rem' }}>
        Two-factor authentication:{' '}
        <strong>{user.two_factor_enabled ? 'Enabled' : user.mfa_required ? 'Required — not set up' : 'Not required'}</strong>
      </p>
      <button type="button" className="dm-btn-cta" disabled={busy} onClick={() => void onRevokeAll()}>
        {busy ? 'Revoking…' : 'Sign out everywhere'}
      </button>
      {message && (
        <p className="dm-auth-banner" role="status" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="dm-auth-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </section>
  );
}
