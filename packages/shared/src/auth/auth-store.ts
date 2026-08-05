import { create } from 'zustand';
import type { DmUser, UserRole } from '../types/domain';
import { apiFetch, getApiBase } from '../lib/api';

interface AuthState {
  user: DmUser | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
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
  };
}

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
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        set({ loading: false });
        return { error: data.message ?? 'Sign in failed' };
      }
      const me = await apiFetch<Record<string, unknown>>('/api/me');
      set({ user: mapUser(me), loading: false });
      return {};
    } catch (e) {
      set({ loading: false });
      return { error: e instanceof Error ? e.message : 'Sign in failed' };
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

export function roleAllowed(userRole: UserRole | undefined, allowed: UserRole | UserRole[]): boolean {
  if (!userRole) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(userRole);
}
