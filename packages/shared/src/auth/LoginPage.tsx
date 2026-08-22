import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../analytics/track';
import { bloxMeta } from '../config/blox-tokens';
import { BloxLogo } from '../components/BloxLogo';
import { getApiBase } from '../lib/api';
import { useAuthStore, readAuthError } from './auth-store';

const reasonCopy: Record<string, string> = {
  not_customer: 'This marketplace account area is for customers only. Sign out to continue as another role, or create a customer account.',
  not_dealer: 'This portal is for dealer staff only.',
  not_credit: 'This portal is for credit officers only.',
  not_finance: 'This portal is for finance officers only.',
  not_admin: 'This portal is for admins only.',
  not_super_admin: 'This portal is for super-admins only.',
  unverified: 'Verify your email before continuing.',
};

interface LoginPageProps {
  portalLabel: string;
  homePath?: string;
  allowSignUp?: boolean;
  /** Marketplace-only: show link back to public browse. Ops portals leave this off. */
  showMarketplaceLink?: boolean;
  brandName?: string;
  tagline?: string;
}

export function LoginPage({
  portalLabel,
  homePath = '/app/dashboard',
  allowSignUp = false,
  showMarketplaceLink = false,
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: LoginPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason = params.get('reason');
  const returnUrl = params.get('returnUrl');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(
        /not verified/i.test(result.error)
          ? 'Your email is not verified yet. Check your inbox for the verification link before signing in.'
          : result.error,
      );
      return;
    }
    if (result.twoFactorRequired) {
      const next = returnUrl
        ? `/auth/two-factor?returnUrl=${returnUrl}`
        : `/auth/two-factor?returnUrl=${encodeURIComponent(homePath)}`;
      navigate(next);
      return;
    }
    navigate(returnUrl ? decodeURIComponent(returnUrl) : homePath);
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel={portalLabel} />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">{portalLabel}</p>
          <h1>Sign in</h1>
          <p className="dm-auth-card__lead">{t('auth.signInLead')}</p>

          {(reason || (user && reason)) && (
            <div className="dm-auth-banner" role="status">
              {reason === 'session_expired' ? (
                <p>{t('auth.sessionExpired')}</p>
              ) : reason ? (
                <p>{reasonCopy[reason] ?? reason}</p>
              ) : null}
              {user && reason && (
                <p className="dm-auth-banner__session">
                  Signed in as <strong>{user.email}</strong> ({user.role}).{' '}
                  <button type="button" className="dm-auth-linkbtn" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </p>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="dm-auth-form">
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>
            {error && <p className="dm-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="dm-auth-foot" style={{ marginTop: 14 }}>
              <Link to="/auth/forgot-password">Forgot password?</Link>
            </p>
          </form>
          {(allowSignUp || showMarketplaceLink) && (
            <p className="dm-auth-foot">
              {allowSignUp && (
                <>
                  No account? <Link to="/auth/register">Create one</Link>
                  {showMarketplaceLink && (
                    <span className="dm-auth-foot__sep" aria-hidden>
                      ·
                    </span>
                  )}
                </>
              )}
              {showMarketplaceLink && <Link to="/">Back to marketplace</Link>}
            </p>
          )}
        </div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

interface RegisterPageProps {
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

export function RegisterPage({
  homePath = '/app/dashboard',
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: RegisterPageProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    trackProductEvent('signup_started', { source: 'marketplace' });
    const result = await signUp(email.trim(), password, name.trim());
    if (result.error) {
      setError(result.error);
      return;
    }
    const verifyPath = returnUrl
      ? `/auth/verify-email?returnUrl=${returnUrl}`
      : '/auth/verify-email';
    navigate(verifyPath);
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel="Create customer account" />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">Customer marketplace</p>
          <h1>Create account</h1>
          <p className="dm-auth-card__lead">{t('auth.signUpLead')}</p>
          <form onSubmit={onSubmit} className="dm-auth-form">
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </label>
            {error && <p className="dm-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="dm-auth-foot">
            Already have an account? <Link to="/auth/login">Sign in</Link>
            <span className="dm-auth-foot__sep" aria-hidden>
              ·
            </span>
            <Link to="/">Back to marketplace</Link>
          </p>
        </div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

/** P0-3: request a password-reset email (Better Auth requestPasswordReset). */
export function ForgotPasswordPage({
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: {
  brandName?: string;
  tagline?: string;
}) {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/request-password-reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Could not send reset email. Try again.');
        return;
      }
      // Always confirm — never reveal whether the address has an account.
      setSent(true);
    } catch {
      setError('Could not send reset email. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel="Account recovery" />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">Account recovery</p>
          <h1>Reset password</h1>
          {sent ? (
            <>
              <p className="dm-auth-card__lead">
                If an account exists for <strong>{email}</strong>, a reset link is on its way.
                Check your inbox (and spam folder).
              </p>
              <p className="dm-auth-foot">
                <Link to="/auth/login">Back to sign in</Link>
              </p>
            </>
          ) : (
            <>
              <p className="dm-auth-card__lead">
                Enter your account email and we&apos;ll send you a link to set a new password.
              </p>
              <form onSubmit={onSubmit} className="dm-auth-form">
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </label>
                {error && <p className="dm-auth-error">{error}</p>}
                <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="dm-auth-foot">
                <Link to="/auth/login">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

/** P0-3: set a new password from the emailed token. */
export function ResetPasswordPage({
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: {
  brandName?: string;
  tagline?: string;
}) {
  const [params] = useSearchParams();
  const token = params.get('token');
  const tokenError = params.get('error');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Reset link is invalid or expired. Request a new one.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reset password. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = !token || tokenError;

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel="Account recovery" />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">Account recovery</p>
          <h1>Choose a new password</h1>
          {done ? (
            <>
              <p className="dm-auth-card__lead">Your password has been updated.</p>
              <p className="dm-auth-foot">
                <Link to="/auth/login">Sign in with your new password</Link>
              </p>
            </>
          ) : invalidLink ? (
            <>
              <p className="dm-auth-card__lead">
                This reset link is invalid or has expired.
              </p>
              <p className="dm-auth-foot">
                <Link to="/auth/forgot-password">Request a new link</Link>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmit} className="dm-auth-form">
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Repeat the password"
                />
              </label>
              {error && <p className="dm-auth-error">{error}</p>}
              <button type="submit" className="dm-btn-cta dm-auth-submit" disabled={busy}>
                {busy ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

interface VerifyEmailPageProps {
  portalLabel?: string;
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

/** Gate for authenticated users who still need to verify their inbox. */
export function VerifyEmailPage({
  portalLabel = 'Account verification',
  homePath = '/app/dashboard',
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: VerifyEmailPageProps) {
  const { t } = useTranslation();
  const { user, initialized, init, loading, refreshProfile, signOut } = useAuthStore();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    void init();
  }, [init]);

  async function resendVerification() {
    if (!user?.email) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/send-verification-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email.trim().toLowerCase(),
          callbackURL: `${window.location.origin}/auth/verify-email`,
        }),
      });
      if (!res.ok) {
        setError(await readAuthError(res));
        return;
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.verifyEmailResendFailed'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initialized || loading || !user || user.email_verified || autoSentRef.current) return;
    autoSentRef.current = true;
    void resendVerification();
  }, [initialized, loading, user]);

  async function checkVerified() {
    await refreshProfile();
  }

  if (!initialized || loading) {
    return (
      <div style={{ padding: 48, fontFamily: 'var(--dm-font-ui)', color: 'var(--dm-slate-600)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    const loginReturn = returnUrl ? `?returnUrl=${returnUrl}` : '';
    return <Navigate to={`/auth/login${loginReturn}`} replace />;
  }

  if (user.email_verified) {
    return <Navigate to={returnUrl ? decodeURIComponent(returnUrl) : homePath} replace />;
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel={portalLabel} />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">{portalLabel}</p>
          <h1>{t('auth.verifyEmailTitle')}</h1>
          <p className="dm-auth-card__lead">
            {t('auth.verifyEmailLead', { email: user.email })}
          </p>
          {sent && (
            <div className="dm-auth-banner" role="status">
              <p>{t('auth.verifyEmailSent')}</p>
            </div>
          )}
          {error && <p className="dm-auth-error">{error}</p>}
          <button
            type="button"
            className="dm-btn-cta dm-auth-submit"
            disabled={busy}
            onClick={() => void resendVerification()}
          >
            {busy ? t('auth.verifyEmailSending') : t('auth.verifyEmailResend')}
          </button>
          <button
            type="button"
            className="dm-auth-linkbtn"
            style={{ marginTop: 14, display: 'block' }}
            onClick={() => void checkVerified()}
          >
            {t('auth.verifyEmailContinue')}
          </button>
          <p className="dm-auth-foot">
            <button
              type="button"
              className="dm-auth-linkbtn"
              onClick={() => {
                void signOut().then(() => {
                  window.location.assign('/auth/login');
                });
              }}
            >
              {t('auth.verifyEmailSignOut')}
            </button>
          </p>
        </div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

function AuthBrandPanel({
  brandName,
  tagline,
  portalLabel,
}: {
  brandName: string;
  tagline: string;
  portalLabel: string;
}) {
  return (
    <aside className="dm-auth-brand" aria-label={`${brandName} brand`}>
      <div className="dm-auth-brand__media" role="img" aria-label="Vehicle on a coastal road at dusk" />
      <div className="dm-auth-brand__scrim" />
      <div className="dm-auth-brand__glow" aria-hidden />
      <div className="dm-auth-brand__content">
        <p className="dm-auth-brand__portal">{portalLabel}</p>
        <BloxLogo height={44} tone="onDark" className="dm-auth-brand__logo" />
        <p className="dm-auth-brand__tag">{tagline}</p>
        <ul className="dm-auth-brand__points">
          <li>Published dealer inventory across Qatar</li>
          <li>Build your stake with clear contribution estimates</li>
          <li>One ownership journey from browse to fully yours</li>
        </ul>
      </div>
    </aside>
  );
}

function AuthPageStyles() {
  return (
    <style>{`
      .dm-auth-layout {
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(340px, 460px);
        background: var(--dm-canvas, #f0f5f5);
      }

      .dm-auth-brand {
        position: relative;
        overflow: hidden;
        color: #fff;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: 100%;
      }

      .dm-auth-brand__media {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(120deg, rgba(15, 63, 69, 0.2), transparent 50%),
          url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=80')
            center / cover no-repeat;
        transform: scale(1.04);
        animation: dm-auth-ken 18s ease-in-out infinite alternate;
      }

      .dm-auth-brand__scrim {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(105deg, rgba(15, 63, 69, 0.94) 0%, rgba(22, 83, 91, 0.78) 42%, rgba(22, 83, 91, 0.45) 100%),
          linear-gradient(0deg, rgba(15, 63, 69, 0.88) 0%, transparent 55%);
      }

      .dm-auth-brand__glow {
        position: absolute;
        width: 48%;
        height: 48%;
        right: -8%;
        top: -10%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 207, 162, 0.28) 0%, transparent 70%);
        pointer-events: none;
        animation: dm-auth-pulse 6s ease-in-out infinite;
      }

      .dm-auth-brand__content {
        position: relative;
        z-index: 1;
        padding: clamp(32px, 6vw, 64px);
        max-width: 36rem;
        animation: dm-auth-rise 520ms var(--dm-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
      }

      .dm-auth-brand__portal {
        margin: 0 0 18px;
        color: var(--dm-amber, #dbff00);
        font-weight: 650;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.72rem;
      }

      .dm-auth-brand__name {
        margin: 0 0 14px;
        font-family: var(--dm-font-display, 'Space Grotesk', sans-serif);
        font-size: clamp(3rem, 7vw, 4.75rem);
        font-weight: 700;
        line-height: 0.95;
        letter-spacing: -0.03em;
      }

      .dm-auth-brand__logo {
        margin: 0 0 14px;
        display: block;
      }

      .dm-auth-brand__tag {
        margin: 0 0 28px;
        color: rgba(255, 255, 255, 0.86);
        font-size: clamp(1.05rem, 2vw, 1.25rem);
        line-height: 1.45;
        max-width: 22ch;
      }

      .dm-auth-brand__points {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }

      .dm-auth-brand__points li {
        position: relative;
        padding-inline-start: 18px;
        color: rgba(255, 255, 255, 0.72);
        font-size: 0.92rem;
        line-height: 1.4;
      }

      .dm-auth-brand__points li::before {
        content: '';
        position: absolute;
        inset-inline-start: 0;
        top: 0.55em;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dm-amber, #dbff00);
        box-shadow: 0 0 0 3px rgba(219, 255, 0, 0.18);
      }

      .dm-auth-card {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(28px, 5vw, 48px) clamp(24px, 4vw, 40px);
        background:
          radial-gradient(120% 80% at 100% 0%, rgba(0, 207, 162, 0.08), transparent 55%),
          var(--dm-surface, #fff);
        border-inline-start: 1px solid var(--dm-slate-200, #d8e2e2);
      }

      .dm-auth-card__inner {
        width: 100%;
        max-width: 360px;
        animation: dm-auth-rise 560ms 80ms var(--dm-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
      }

      .dm-auth-card__eyebrow {
        margin: 0 0 10px;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--dm-steel, #16535b);
        opacity: 0.7;
      }

      .dm-auth-card h1 {
        font-family: var(--dm-font-display, 'Space Grotesk', sans-serif);
        font-size: clamp(1.85rem, 3vw, 2.15rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--dm-ink, #16535b);
        margin: 0 0 8px;
      }

      .dm-auth-card__lead {
        margin: 0 0 28px;
        color: var(--dm-slate-600, #5b6b73);
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .dm-auth-form {
        display: grid;
        gap: 4px;
      }

      .dm-auth-card label {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 14px;
        font-size: 0.8rem;
        font-weight: 650;
        letter-spacing: 0.01em;
        color: var(--dm-slate-600, #5b6b73);
      }

      .dm-auth-card input {
        min-height: 48px;
        padding: 0 14px;
        border: 1px solid var(--dm-slate-200, #d8e2e2);
        border-radius: 12px;
        font: inherit;
        font-size: 0.95rem;
        color: var(--dm-ink, #16535b);
        background: #fff;
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }

      .dm-auth-card input::placeholder {
        color: #9aa8ae;
      }

      .dm-auth-card input:hover {
        border-color: #b7c8c8;
      }

      .dm-auth-card input:focus {
        outline: none;
        border-color: var(--dm-steel, #16535b);
        box-shadow: 0 0 0 3px rgba(0, 207, 162, 0.22);
      }

      .dm-auth-error {
        margin: 0 0 8px;
        color: var(--dm-danger, #b42318);
        font-size: 0.875rem;
      }

      .dm-auth-banner {
        background: linear-gradient(180deg, #fff8eb, #fff3dc);
        color: #8a5a14;
        padding: 14px 16px;
        border-radius: 12px;
        margin-bottom: 22px;
        border: 1px solid rgba(196, 122, 0, 0.22);
        font-size: 0.875rem;
        line-height: 1.45;
      }

      .dm-auth-banner p {
        margin: 0;
      }

      .dm-auth-banner__session {
        margin-top: 10px !important;
        padding-top: 10px;
        border-top: 1px solid rgba(196, 122, 0, 0.18);
      }

      .dm-auth-submit {
        width: 100%;
        margin-top: 6px;
        min-height: 52px;
        border-radius: 12px;
        font-size: 1rem;
        letter-spacing: 0.01em;
        transition: transform 160ms ease, background 160ms ease;
      }

      .dm-auth-submit:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .dm-auth-submit:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .dm-auth-foot {
        margin: 28px 0 0;
        font-size: 0.9rem;
        color: var(--dm-slate-600, #5b6b73);
      }

      .dm-auth-foot a {
        color: var(--dm-steel, #16535b);
        font-weight: 650;
        text-decoration: none;
        border-bottom: 1px solid rgba(22, 83, 91, 0.25);
      }

      .dm-auth-foot a:hover {
        border-bottom-color: var(--dm-steel, #16535b);
      }

      .dm-auth-foot__sep {
        margin: 0 8px;
        opacity: 0.45;
      }

      .dm-auth-linkbtn {
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
        padding: 0;
      }

      @keyframes dm-auth-rise {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes dm-auth-ken {
        from { transform: scale(1.04) translate3d(0, 0, 0); }
        to { transform: scale(1.1) translate3d(-1.5%, -1%, 0); }
      }

      @keyframes dm-auth-pulse {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.08); }
      }

      @media (max-width: 900px) {
        .dm-auth-layout {
          grid-template-columns: 1fr;
        }
        .dm-auth-brand {
          min-height: 42vh;
          min-height: 42dvh;
        }
        .dm-auth-brand__content {
          padding: 28px 24px 32px;
        }
        .dm-auth-brand__name {
          font-size: clamp(2.4rem, 10vw, 3.2rem);
        }
        .dm-auth-brand__points {
          display: none;
        }
        .dm-auth-card {
          border-inline-start: none;
          border-top: 1px solid var(--dm-slate-200, #d8e2e2);
          align-items: flex-start;
          padding-top: 32px;
          padding-bottom: 48px;
        }
      }

      @media (max-width: 480px) {
        .dm-auth-brand {
          min-height: 28vh;
          min-height: 28dvh;
        }
        .dm-auth-brand__content {
          padding: 20px 16px 24px;
        }
        .dm-auth-brand__logo {
          margin-bottom: 10px;
        }
        .dm-auth-brand__tag {
          margin-bottom: 16px;
          font-size: 1rem;
        }
        .dm-auth-card {
          padding-top: 24px;
          padding-bottom: 32px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .dm-auth-brand__media,
        .dm-auth-brand__glow,
        .dm-auth-brand__content,
        .dm-auth-card__inner {
          animation: none !important;
        }
        .dm-auth-brand__media { transform: none; }
      }
    `}</style>
  );
}
