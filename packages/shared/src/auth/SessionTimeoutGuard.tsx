import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { useAuthStore } from './auth-store';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'focus',
  'input',
  'change',
  'click',
  'pointerdown',
] as const;

/**
 * Client half of the session policy (LOS FSD §11.2). The API expires an idle
 * cookie session after `idle_timeout_sec`; this guard mirrors that on the
 * device so the user sees a countdown instead of a surprise 401, and signs out
 * cleanly when it runs out. "Stay signed in" pings `/api/me`, which refreshes
 * the server session. The absolute ceiling is enforced server-side only.
 *
 * The heartbeat matters as much as the countdown. The API measures idleness in
 * requests, and filling in a long form makes none, so someone typing steadily
 * for longer than the idle window used to be signed out mid-sentence and lose
 * the page. While there is real interaction, and only then, this pings the API
 * so the server sees the same activity the browser does. An unattended tab
 * still times out: the ping needs interaction since the last one, and stops
 * while the tab is hidden or the warning is on screen.
 */
export function SessionTimeoutGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const policy = user?.session_policy ?? null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const activeSincePing = useRef(false);
  const warningOpen = useRef(false);
  const signingOut = useRef(false);

  const signOutForIdle = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await useAuthStore.getState().signOut();
    window.location.assign('/auth/login?reason=idle_timeout');
  }, []);

  useEffect(() => {
    if (!policy || !user) return undefined;
    const idleMs = policy.idle_timeout_sec * 1000;
    const warnMs = Math.max(5, policy.warning_sec) * 1000;
    lastActivity.current = Date.now();

    // Refresh well inside the idle window so the server sees the same activity
    // the browser does. Cookie-cache or a long gap between pings used to let
    // the API expire the session while the user was still typing.
    const pingMs = Math.min(60_000, Math.max(20_000, Math.floor(idleMs / 6)));
    lastPing.current = Date.now();
    activeSincePing.current = false;

    const onActivity = () => {
      if (warningOpen.current) return;
      lastActivity.current = Date.now();
      activeSincePing.current = true;
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      const remaining = idleMs - (now - lastActivity.current);
      if (remaining <= 0) {
        void signOutForIdle();
        return;
      }

      const tabVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (!warningOpen.current && activeSincePing.current && tabVisible && now - lastPing.current >= pingMs) {
        lastPing.current = now;
        activeSincePing.current = false;
        // A failure here needs no handling: the shared 401 handler already
        // signs out, and the countdown above still expires the session.
        void apiFetch('/api/me').catch(() => undefined);
      }

      if (remaining <= warnMs) {
        warningOpen.current = true;
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningOpen.current) {
        warningOpen.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [policy, user, signOutForIdle]);

  function stay() {
    lastActivity.current = Date.now();
    lastPing.current = Date.now();
    activeSincePing.current = false;
    warningOpen.current = false;
    setSecondsLeft(null);
    void useAuthStore.getState().refreshProfile();
  }

  return (
    <>
      {children}
      {secondsLeft != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dm-session-timeout-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10_000,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(10, 14, 20, 0.55)',
            padding: 16,
          }}
        >
          <div
            style={{
              width: 'min(420px, 100%)',
              background: 'var(--dm-surface, #fff)',
              color: 'var(--dm-ink, #0f172a)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              fontFamily: 'var(--dm-font-ui, system-ui, sans-serif)',
            }}
          >
            <h2 id="dm-session-timeout-title" style={{ margin: '0 0 8px', fontSize: 20 }}>
              {t('sessionPolicy.idleTitle')}
            </h2>
            <p style={{ margin: '0 0 20px', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
              {t('sessionPolicy.idleBody', { seconds: secondsLeft })}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void signOutForIdle()}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid var(--dm-slate-200, #cbd5e1)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {t('sessionPolicy.signOut')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={stay}
                style={{
                  minHeight: 44,
                  padding: '0 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--dm-cta, #0f172a)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('sessionPolicy.stay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
