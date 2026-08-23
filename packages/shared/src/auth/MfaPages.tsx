import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bloxMeta } from '../config/blox-tokens';
import type { OpsPortalKey } from '../config/ops-portal-keys';
import { opsPortalAuthKeys } from '../config/ops-portal-auth';
import { ConfirmDialog, OpsAuthCardInner, OpsAuthLayout } from '../ops-ui-v2';
import { OpsPageHeader, OpsSecondaryButton } from '../components/ops-ui';
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
  tagline?: string;
  brandPoints?: string[];
  children: React.ReactNode;
}

function MfaPageShell({
  portalLabel,
  title,
  lead,
  tagline = bloxMeta.tagline,
  brandPoints,
  children,
}: MfaPageShellProps) {
  return (
    <OpsAuthLayout portalLabel={portalLabel} tagline={tagline} brandPoints={brandPoints}>
      <OpsAuthCardInner>
        <p className="dm-auth-card__eyebrow blox-auth-card__eyebrow">{portalLabel}</p>
        <h1>{title}</h1>
        <p className="dm-auth-card__lead blox-auth-card__lead">{lead}</p>
        {children}
      </OpsAuthCardInner>
    </OpsAuthLayout>
  );
}

interface TwoFactorLoginPageProps {
  portalLabel?: string;
  portalKey?: OpsPortalKey;
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

/** Second step after password sign-in when TOTP is enabled. */
export function TwoFactorLoginPage({
  portalLabel,
  portalKey,
  homePath = '/',
  brandName,
  tagline,
}: TwoFactorLoginPageProps) {
  const { t } = useTranslation();
  const resolvedLabel = portalKey
    ? t(`ops.auth.portals.${portalKey}.label`)
    : (portalLabel ?? brandName ?? bloxMeta.name);
  const resolvedTagline = portalKey
    ? t(`ops.auth.portals.${portalKey}.tagline`)
    : tagline;
  const brandPoints = portalKey
    ? opsPortalAuthKeys(portalKey).brandPointKeys.map((key) => t(key))
    : undefined;
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
      portalLabel={resolvedLabel}
      title="Two-factor verification"
      lead="Enter the 6-digit code from your authenticator app to finish signing in."
      tagline={resolvedTagline}
      brandPoints={brandPoints}
    >
      <form onSubmit={onSubmit} className="dm-auth-form blox-auth-form">
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
        {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
        <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={loading || code.length !== 6}>
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
  portalLabel?: string;
  portalKey?: OpsPortalKey;
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

/** Mandatory TOTP enrollment for privileged ops roles. */
export function MfaSetupPage({
  portalLabel,
  portalKey,
  homePath = '/',
  brandName,
  tagline,
}: MfaSetupPageProps) {
  const { t } = useTranslation();
  const resolvedLabel = portalKey
    ? t(`ops.auth.portals.${portalKey}.label`)
    : (portalLabel ?? brandName ?? bloxMeta.name);
  const resolvedTagline = portalKey
    ? t(`ops.auth.portals.${portalKey}.tagline`)
    : tagline;
  const brandPoints = portalKey
    ? opsPortalAuthKeys(portalKey).brandPointKeys.map((key) => t(key))
    : undefined;
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
      portalLabel={resolvedLabel}
      title="Set up two-factor authentication"
      lead="Privileged Blox accounts must use an authenticator app before accessing the portal."
      tagline={resolvedTagline}
      brandPoints={brandPoints}
    >
      {step === 'password' ? (
        <form onSubmit={startSetup} className="dm-auth-form blox-auth-form">
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
          {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
          <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={loading}>
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
          <form onSubmit={confirmSetup} className="dm-auth-form blox-auth-form">
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
            {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={loading || code.length !== 6}>
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) return null;

  async function onRevokeAll() {
    setBusy(true);
    setMessage(null);
    setError(null);
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
    <section className={`blox-detail-section${className ? ` ${className}` : ''}`} style={{ marginTop: 24 }}>
      <OpsPageHeader title="Security" />
      <p style={{ margin: '0 0 12px', color: 'var(--blox-slate)', fontSize: '0.92rem' }}>
        Two-factor authentication:{' '}
        <strong>{user.two_factor_enabled ? 'Enabled' : user.mfa_required ? 'Required — not set up' : 'Not required'}</strong>
      </p>
      <OpsSecondaryButton type="button" disabled={busy} onClick={() => setConfirmOpen(true)}>
        {busy ? 'Revoking…' : 'Sign out everywhere'}
      </OpsSecondaryButton>
      {message && (
        <p className="dm-auth-banner" role="status" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="dm-auth-error blox-auth-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Sign out everywhere"
        message="This signs you out on every device, including this browser. Continue?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void onRevokeAll();
        }}
      />
    </section>
  );
}
