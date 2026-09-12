import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../analytics/track';
import { bloxMeta } from '../config/blox-tokens';
import type { OpsPortalKey } from '../config/ops-portal-keys';
import { opsPortalAuthKeys } from '../config/ops-portal-auth';
import { BloxLogo } from '../components/BloxLogo';
import { OpsAuthCardInner, OpsAuthLayout } from '../ops-ui-v2';
import { getApiBase } from '../lib/api';
import { getAppLocale, setAppLocale, type AppLocale } from '../i18n';
import { useAuthStore, readAuthError } from './auth-store';

const PORTAL_MISMATCH_REASONS = new Set([
  'not_customer',
  'not_dealer',
  'not_credit',
  'not_finance',
  'not_admin',
  'not_super_admin',
]);

const reasonCopy: Record<string, string> = {
  not_customer:
    'This area is for customer accounts. Sign in with your customer account, or create one.',
  not_dealer: 'This is the dealer portal. Sign in with your dealer staff account.',
  not_credit: 'This is the credit portal. Sign in with your credit officer account.',
  not_finance: 'This is the finance portal. Sign in with your finance officer account.',
  not_admin: 'This is the admin portal. Sign in with your admin account.',
  not_super_admin: 'This is the ops portal. Sign in with your super-admin account.',
  unverified: 'Verify your email before continuing.',
  password_reset: 'Your password has been updated. Sign in with your new password.',
  idle_timeout: 'You were signed out after a period of inactivity. Sign in again to continue.',
  absolute_timeout: 'Your session reached its maximum length. Sign in again to continue.',
};

interface LoginPageProps {
  /** Display label; omitted when `portalKey` is set (resolved from i18n). */
  portalLabel?: string;
  /** Ops portal key. resolves label, tagline, and brand points from i18n. */
  portalKey?: OpsPortalKey;
  homePath?: string;
  allowSignUp?: boolean;
  /** Marketplace-only: show link back to public browse. Ops portals leave this off. */
  showMarketplaceLink?: boolean;
  brandName?: string;
  tagline?: string;
}

export function LoginPage({
  portalLabel,
  portalKey,
  homePath = '/app/dashboard',
  allowSignUp = false,
  showMarketplaceLink = false,
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: LoginPageProps) {
  const { t } = useTranslation();
  const resolvedLabel = portalKey
    ? t(`ops.auth.portals.${portalKey}.label`)
    : (portalLabel ?? brandName);
  const resolvedTagline = portalKey
    ? t(`ops.auth.portals.${portalKey}.tagline`)
    : tagline;
  const brandPoints = portalKey
    ? opsPortalAuthKeys(portalKey).brandPointKeys.map((key) => t(key))
    : undefined;
  const signInLead = portalKey ? t('ops.auth.signInLead') : t('auth.signInLead');
  const [email, setEmail] = useState(() => localStorage.getItem('blox.rememberEmail') ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('blox.rememberEmail')));
  const [error, setError] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason = params.get('reason');
  const returnUrl = params.get('returnUrl');
  const portalMismatch = reason ? PORTAL_MISMATCH_REASONS.has(reason) : false;

  // Each ops portal expects its own role. clear a session from another portal.
  useEffect(() => {
    if (!portalMismatch || !user) return;
    void signOut();
  }, [portalMismatch, user, signOut]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rememberMe) localStorage.setItem('blox.rememberEmail', email.trim());
    else localStorage.removeItem('blox.rememberEmail');
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
    <OpsAuthLayout portalLabel={resolvedLabel} tagline={resolvedTagline} brandPoints={brandPoints}>
      <OpsAuthCardInner>
          <p className="dm-auth-card__eyebrow blox-auth-card__eyebrow">{resolvedLabel}</p>
          <h1>Sign in</h1>
          <p className="dm-auth-card__lead blox-auth-card__lead">{signInLead}</p>

          {(reason || (user && reason)) && (
            <div className="dm-auth-banner" role="status">
              {reason === 'session_expired' ? (
                <p>{t('auth.sessionExpired')}</p>
              ) : reason ? (
                <p>{reasonCopy[reason] ?? reason}</p>
              ) : null}
              {user && reason && !portalMismatch && (
                <p className="dm-auth-banner__session">
                  Signed in as <strong>{user.email}</strong> ({user.role}).{' '}
                  <button type="button" className="dm-auth-linkbtn" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </p>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} className="dm-auth-form blox-auth-form">
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Remember me
            </label>
            {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={loading}>
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
      </OpsAuthCardInner>
      {/* Ops portals are styled by styles/ops/_auth.scss; the marketplace keeps the inline block. */}
      {!portalKey && <AuthPageStyles />}
    </OpsAuthLayout>
  );
}

interface RegisterPageProps {
  homePath?: string;
  brandName?: string;
  tagline?: string;
}

export function RegisterPage({
  homePath: _homePath = '/app/dashboard',
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: RegisterPageProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Captured at registration (LOS FSD Stage 1) so every later message, contract
  // and reminder goes out in the customer's language; choosing it also flips the
  // page so the customer sees the effect at once.
  const [preferredLanguage, setPreferredLanguage] = useState<AppLocale>(() => getAppLocale());
  const [error, setError] = useState<string | null>(null);
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get('returnUrl');

  function chooseLanguage(locale: AppLocale) {
    setPreferredLanguage(locale);
    setAppLocale(locale);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    trackProductEvent('signup_started', { source: 'marketplace' });
    const result = await signUp(email.trim(), password, name.trim(), preferredLanguage);
    if (result.error) {
      setError(result.error);
      return;
    }
    // No session yet when verification is required: carry the address so the
    // verify page can show "check your inbox" and offer a resend without a login.
    const query = [
      returnUrl ? `returnUrl=${returnUrl}` : null,
      result.pendingVerification ? `email=${encodeURIComponent(email.trim().toLowerCase())}` : null,
    ]
      .filter(Boolean)
      .join('&');
    navigate(`/auth/verify-email${query ? `?${query}` : ''}`);
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel="Create customer account" />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">Customer marketplace</p>
          <h1>Create account</h1>
          <p className="dm-auth-card__lead">{t('auth.signUpLead')}</p>
          <form onSubmit={onSubmit} className="dm-auth-form blox-auth-form">
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
            <fieldset className="dm-auth-language" aria-describedby="dm-auth-language-hint">
              <legend>{t('customerProfile.preferences.language')}</legend>
              <div className="dm-auth-language__options" role="radiogroup">
                {(['en', 'ar'] as const).map((locale) => (
                  <label key={locale} className={preferredLanguage === locale ? 'is-active' : ''}>
                    <input
                      type="radio"
                      name="preferred_language"
                      value={locale}
                      checked={preferredLanguage === locale}
                      onChange={() => chooseLanguage(locale)}
                    />
                    {locale === 'en' ? t('customerProfile.preferences.languageEn') : t('customerProfile.preferences.languageAr')}
                  </label>
                ))}
              </div>
              <p id="dm-auth-language-hint" className="dm-auth-language__hint">
                {t('auth.languageHint', { defaultValue: 'Used for messages, reminders and your agreement.' })}
              </p>
            </fieldset>
            {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={loading}>
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

/**
 * Auth frame shared by forgot / reset (Phase 1 §09). With a `portalKey` it renders the ops
 * layout (brand panel + card from OpsAuthLayout, styled by _auth.scss); without one it keeps
 * the marketplace's own dm-auth markup and inline styles untouched.
 */
function AuthFrame({
  portalKey,
  portalLabel,
  brandName,
  tagline,
  children,
}: {
  portalKey?: OpsPortalKey;
  portalLabel: string;
  brandName: string;
  tagline: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (portalKey) {
    const keys = opsPortalAuthKeys(portalKey);
    return (
      <OpsAuthLayout
        portalLabel={t(keys.portalLabelKey)}
        tagline={t(keys.taglineKey)}
        brandPoints={keys.brandPointKeys.map((key) => t(key))}
      >
        <OpsAuthCardInner>{children}</OpsAuthCardInner>
      </OpsAuthLayout>
    );
  }
  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel={portalLabel} />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">{children}</div>
      </main>
      <AuthPageStyles />
    </div>
  );
}

/** P0-3: request a password-reset email (Better Auth requestPasswordReset). */
export function ForgotPasswordPage({
  portalKey,
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: {
  /** Ops portals pass their key to get the ops auth layout. */
  portalKey?: OpsPortalKey;
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
      // Always confirm. never reveal whether the address has an account.
      setSent(true);
    } catch {
      setError('Could not send reset email. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame portalKey={portalKey} portalLabel="Account recovery" brandName={brandName} tagline={tagline}>
      <p className="dm-auth-card__eyebrow blox-auth-card__eyebrow">Account recovery</p>
      <h1>Reset password</h1>
      {sent ? (
        <>
          <div className="dm-auth-banner blox-auth-banner" role="status">
            <p>
              If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox
              (and spam folder).
            </p>
          </div>
          <p className="dm-auth-foot blox-auth-foot">
            <Link to="/auth/login">Back to sign in</Link>
          </p>
        </>
      ) : (
        <>
          <p className="dm-auth-card__lead blox-auth-card__lead">
            Enter your account email and we&apos;ll send you a link to set a new password.
          </p>
          <form onSubmit={onSubmit} className="dm-auth-form blox-auth-form">
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
            {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
            <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="dm-auth-foot blox-auth-foot">
            <Link to="/auth/login">Back to sign in</Link>
          </p>
        </>
      )}
    </AuthFrame>
  );
}

/** P0-3: set a new password from the emailed token. */
export function ResetPasswordPage({
  portalKey,
  brandName = bloxMeta.name,
  tagline = bloxMeta.tagline,
}: {
  /** Ops portals pass their key to get the ops auth layout. */
  portalKey?: OpsPortalKey;
  brandName?: string;
  tagline?: string;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
      // Sessions were revoked server-side; send the user straight to sign in.
      navigate('/auth/login?reason=password_reset', { replace: true });
    } catch {
      setError('Could not reset password. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = !token || tokenError;

  return (
    <AuthFrame portalKey={portalKey} portalLabel="Account recovery" brandName={brandName} tagline={tagline}>
      <p className="dm-auth-card__eyebrow blox-auth-card__eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      {done ? (
        <>
          <div className="dm-auth-banner blox-auth-banner" role="status">
            <p>Your password has been updated.</p>
          </div>
          <p className="dm-auth-foot blox-auth-foot">
            <Link to="/auth/login">Sign in with your new password</Link>
          </p>
        </>
      ) : invalidLink ? (
        <>
          <p className="dm-auth-error blox-auth-error" role="alert">
            This reset link is invalid or has expired.
          </p>
          <p className="dm-auth-foot blox-auth-foot">
            <Link to="/auth/forgot-password">Request a new link</Link>
          </p>
        </>
      ) : (
        <form onSubmit={onSubmit} className="dm-auth-form blox-auth-form">
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
          {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
          <button type="submit" className="dm-btn-cta dm-auth-submit blox-auth-submit" disabled={busy}>
            {busy ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </AuthFrame>
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
  // Set by RegisterPage when sign-up created the account but (verification
  // required) no session yet. we still want to show "check your inbox".
  const pendingEmail = params.get('email')?.trim().toLowerCase() || null;
  const targetEmail = user?.email ?? pendingEmail;
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    void init();
  }, [init]);

  async function resendVerification() {
    if (!targetEmail) return;
    setError(null);
    setPendingNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/send-verification-email`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          email: targetEmail.trim().toLowerCase(),
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
    setError(null);
    setPendingNotice(null);
    await refreshProfile();
    const current = useAuthStore.getState().user;
    if (current && !current.email_verified) {
      setPendingNotice(t('auth.verifyEmailStillPending'));
    }
  }

  if (!initialized || loading) {
    return (
      <div style={{ padding: 48, fontFamily: 'var(--dm-font-ui)', color: 'var(--dm-slate-600)' }}>
        Loading…
      </div>
    );
  }

  if (!user && !pendingEmail) {
    const loginReturn = returnUrl ? `?returnUrl=${returnUrl}` : '';
    return <Navigate to={`/auth/login${loginReturn}`} replace />;
  }

  if (user?.email_verified) {
    return <Navigate to={returnUrl ? decodeURIComponent(returnUrl) : homePath} replace />;
  }

  // Fresh sign-up, no session: the sign-up already sent the first email.
  if (!user && pendingEmail) {
    const loginReturn = returnUrl ? `?returnUrl=${returnUrl}` : '';
    return (
      <div className="dm-auth-layout">
        <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel={portalLabel} />
        <main className="dm-auth-card">
          <div className="dm-auth-card__inner">
            <p className="dm-auth-card__eyebrow">{portalLabel}</p>
            <h1>{t('auth.verifyEmailTitle')}</h1>
            <p className="dm-auth-card__lead">{t('auth.verifyEmailPendingLead', { email: pendingEmail })}</p>
            <div className="dm-auth-banner" role="status">
              <p>{sent ? t('auth.verifyEmailSent') : t('auth.verifyEmailPendingHint')}</p>
            </div>
            {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
            <button
              type="button"
              className="dm-btn-cta dm-auth-submit blox-auth-submit"
              disabled={busy}
              onClick={() => void resendVerification()}
            >
              {busy ? t('auth.verifyEmailSending') : t('auth.verifyEmailResend')}
            </button>
            <p className="dm-auth-foot" style={{ marginTop: 14 }}>
              <Link to={`/auth/login${loginReturn}`}>{t('auth.verifyEmailPendingSignIn')}</Link>
              <span className="dm-auth-foot__sep" aria-hidden>
                ·
              </span>
              <Link to="/auth/register">{t('auth.verifyEmailPendingWrongEmail')}</Link>
            </p>
          </div>
        </main>
        <AuthPageStyles />
      </div>
    );
  }

  return (
    <div className="dm-auth-layout">
      <AuthBrandPanel brandName={brandName} tagline={tagline} portalLabel={portalLabel} />
      <main className="dm-auth-card">
        <div className="dm-auth-card__inner">
          <p className="dm-auth-card__eyebrow">{portalLabel}</p>
          <h1>{t('auth.verifyEmailTitle')}</h1>
          <p className="dm-auth-card__lead">
            {t('auth.verifyEmailLead', { email: targetEmail })}
          </p>
          {sent && (
            <div className="dm-auth-banner" role="status">
              <p>{t('auth.verifyEmailSent')}</p>
            </div>
          )}
          {error && <p className="dm-auth-error blox-auth-error">{error}</p>}
          {pendingNotice && (
            <div className="dm-auth-banner" role="status">
              <p>{pendingNotice}</p>
            </div>
          )}
          <button
            type="button"
            className="dm-btn-cta dm-auth-submit blox-auth-submit"
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
        color: var(--dm-amber);
        font-weight: 650;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.72rem;
      }

      .dm-auth-brand__name {
        margin: 0 0 14px;
        font-family: var(--dm-font-display, 'Inter', sans-serif);
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
        background: var(--dm-amber);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--dm-amber) 18%, transparent);
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
        font-family: var(--dm-font-display, 'Inter', sans-serif);
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

      .dm-auth-language {
        border: 0;
        margin: 0 0 12px;
        padding: 0;
        min-inline-size: 0;
      }
      .dm-auth-language legend {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--dm-slate-600, #475467);
        margin-block-end: 6px;
        padding: 0;
      }
      .dm-auth-language__options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .dm-auth-language__options label {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 44px;
        border: 1px solid var(--dm-slate-200, #d0d5dd);
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        margin: 0;
      }
      .dm-auth-language__options label.is-active {
        border-color: var(--dm-steel, #16535b);
        background: var(--dm-steel-soft, #e6f2f0);
      }
      .dm-auth-language__options input {
        position: absolute;
        opacity: 0;
        inline-size: 1px;
        block-size: 1px;
      }
      .dm-auth-language__options label:focus-within {
        box-shadow: 0 0 0 3px rgba(0, 207, 162, 0.22);
      }
      .dm-auth-language__hint {
        margin: 6px 0 0;
        font-size: 0.8125rem;
        color: var(--dm-slate-600, #475467);
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
