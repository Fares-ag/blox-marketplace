import { create } from 'zustand';
import type { DmUser, UserRole } from '../types/domain';
import { apiFetch, getApiBase, registerUnauthorizedHandler, resetUnauthorizedLatch } from '../lib/api';

interface AuthState {
  user: DmUser | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string; twoFactorRequired?: boolean }>;
  verifyTwoFactor: (code: string, trustDevice?: boolean) => Promise<{ error?: string }>;
  enableTwoFactor: (password: string) => Promise<{ error?: string; totpURI?: string; backupCodes?: string[] }>;
  verifyTwoFactorSetup: (code: string) => Promise<{ error?: string }>;
  revokeAllSessions: () => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function mapUser(raw: Record<string, unknown>): DmUser {
  return {
    id: String(raw.id),
    email: String(raw.email),
    role: raw.role as UserRole,
    company_id: (raw.company_id as string | null) ?? null,
    credit_scope: (raw.credit_scope as DmUser['credit_scope']) ?? 'assigned',
    finance_scope: (raw.finance_scope as DmUser['finance_scope']) ?? 'assigned',
    full_name: (raw.name as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    qid: (raw.qid as string | null) ?? null,
    is_active: Boolean(raw.is_active ?? true),
    email_verified: Boolean(raw.email_verified ?? false),
    two_factor_enabled: Boolean(raw.two_factor_enabled ?? false),
    mfa_required: Boolean(raw.mfa_required ?? false),
    mfa_setup_required: Boolean(raw.mfa_setup_required ?? false),
  };
}

async function readAuthError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
  if (data.code === 'ACCOUNT_LOCKED') return data.message ?? 'Account temporarily locked.';
  if (data.code === 'EMAIL_MISMATCH') {
    return 'Session mismatch. Sign out, sign in again, then resend the verification email.';
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    if (data.message === 'Internal Server Error' && res.status >= 500) {
      return 'Could not send verification email. Try again in a minute or check your spam folder.';
    }
    return data.message;
  }
  if (res.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  return res.statusText || 'Request failed';
}

export { readAuthError };

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false, initialized: true });
    } catch {
      set({ user: null, loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const res = await fetch(`${getApiBase()}/api/auth/sign-in/email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
        twoFactorRedirect?: boolean;
      };
      if (!res.ok) {
        set({ loading: false });
        if (data.code === 'ACCOUNT_LOCKED') {
          return { error: data.message ?? 'Account temporarily locked.' };
        }
        return { error: data.message ?? 'Sign in failed' };
      }
      if (data.twoFactorRedirect) {
        set({ loading: false });
        return { twoFactorRequired: true };
      }
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false });
      return {};
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Sign in failed' };
    }
  },

  verifyTwoFactor: async (code, trustDevice = false) => {
    set({ loading: true });
    try {
      const res = await fetch(`${getApiBase()}/api/auth/two-factor/verify-totp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), trustDevice }),
      });
      if (!res.ok) {
        set({ loading: false });
        return { error: await readAuthError(res) };
      }
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false });
      return {};
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Verification failed' };
    }
  },

  enableTwoFactor: async (password) => {
    set({ loading: true });
    try {
      const res = await fetch(`${getApiBase()}/api/auth/two-factor/enable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, issuer: 'Blox' }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        totpURI?: string;
        backupCodes?: string[];
      };
      set({ loading: false });
      if (!res.ok) {
        return { error: data.message ?? 'Could not start two-factor setup.' };
      }
      return {
        totpURI: data.totpURI,
        backupCodes: data.backupCodes ?? [],
      };
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Could not start two-factor setup.' };
    }
  },

  verifyTwoFactorSetup: async (code) => {
    set({ loading: true });
    try {
      const res = await fetch(`${getApiBase()}/api/auth/two-factor/verify-totp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        set({ loading: false });
        return { error: await readAuthError(res) };
      }
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false });
      return {};
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Verification failed' };
    }
  },

  revokeAllSessions: async () => {
    try {
      await apiFetch<{ status: boolean }>('/api/me/sessions/revoke-all', { method: 'POST' });
      set({ user: null });
      await fetch(`${getApiBase()}/api/auth/sign-out`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not revoke sessions.' };
    }
  },

  signUp: async (email, password, name) => {
    set({ loading: true });
    try {
      const res = await fetch(`${getApiBase()}/api/auth/sign-up/email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        set({ loading: false });
        return { error: data.message ?? 'Sign up failed' };
      }
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false });
      return {};
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Sign up failed' };
    }
  },

  signOut: async () => {
    await fetch(`${getApiBase()}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
    set({ user: null });
  },

  refreshProfile: async () => {
    try {
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me) });
    } catch {
      set({ user: null });
    }
  },
}));

registerUnauthorizedHandler(() => {
  const hadSession = useAuthStore.getState().user !== null;
  useAuthStore.setState({ user: null, loading: false, initialized: true });
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (pathname.startsWith('/auth/')) {
    resetUnauthorizedLatch();
    return;
  }
  // Public marketplace browse — stale cookies must not hijack the landing page.
  if (!hadSession && !pathname.startsWith('/app/')) {
    resetUnauthorizedLatch();
    return;
  }
  const returnUrl = encodeURIComponent(pathname + search);
  window.location.assign(`/auth/login?returnUrl=${returnUrl}&reason=session_expired`);
});

export function roleAllowed(userRole: UserRole | undefined, allowed: UserRole | UserRole[]): boolean {
  if (!userRole) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(userRole);
}
