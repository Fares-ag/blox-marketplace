import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { brandMeta } from '../config/brand-tokens';
import { useAuthStore } from './auth-store';
import type { UserRole } from '../types/domain';

const reasonCopy: Record<string, string> = {
  not_customer: 'This portal is for customers only.',
  not_dealer: 'This portal is for dealer staff only.',
  not_credit: 'This portal is for credit officers only.',
  not_finance: 'This portal is for finance officers only.',
  not_admin: 'This portal is for admins only.',
  not_super_admin: 'This portal is for super-admins only.',
  unverified: 'Verify your email before continuing.',
};

interface LoginPageProps {
  portalLabel: string;
  expectedRole?: UserRole;
  homePath?: string;
}

export function LoginPage({ portalLabel, homePath = '/app/dashboard' }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);
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
      setError(result.error);
      return;
    }
    navigate(returnUrl ? decodeURIComponent(returnUrl) : homePath);
  }

  return (
    <div className="dm-auth-layout">
      <aside className="dm-auth-brand">
        <p className="dm-auth-brand__name">{brandMeta.name}</p>
        <p className="dm-auth-brand__tag">{brandMeta.tagline}</p>
        <p className="dm-auth-brand__portal">{portalLabel}</p>
      </aside>
      <main className="dm-auth-card">
        <h1>Sign in</h1>
        {reason && <p className="dm-auth-banner">{reasonCopy[reason] ?? reason}</p>}
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            />
          </label>
          {error && <p className="dm-auth-error">{error}</p>}
          <button type="submit" className="dm-btn-cta" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="dm-auth-foot">
          <Link to="/">Back</Link>
        </p>
      </main>
      <style>{`
        .dm-auth-layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(320px, 480px);
        }
        @media (max-width: 800px) {
          .dm-auth-layout { grid-template-columns: 1fr; }
          .dm-auth-brand { min-height: 200px; }
        }
        .dm-auth-brand {
          background: linear-gradient(160deg, var(--dm-graphite-980), var(--dm-graphite-800));
          color: #fff;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 12px;
        }
        .dm-auth-brand__name {
          margin: 0;
          font-family: var(--dm-font-display);
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 600;
          line-height: 1.1;
        }
        .dm-auth-brand__tag { margin: 0; color: rgba(255,255,255,0.78); max-width: 28ch; }
        .dm-auth-brand__portal { margin: 24px 0 0; color: var(--dm-amber); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.75rem; }
        .dm-auth-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px;
          background: var(--dm-surface);
        }
        .dm-auth-card h1 {
          font-family: var(--dm-font-display);
          font-size: 1.75rem;
          margin: 0 0 24px;
        }
        .dm-auth-card label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--dm-slate-600);
        }
        .dm-auth-card input {
          min-height: 44px;
          padding: 0 12px;
          border: 1px solid var(--dm-slate-200);
          border-radius: var(--dm-radius-sm);
          font: inherit;
          color: var(--dm-ink);
        }
        .dm-auth-error { color: var(--dm-danger); }
        .dm-auth-banner {
          background: var(--dm-warning-soft);
          color: var(--dm-warning);
          padding: 12px 14px;
          border-radius: var(--dm-radius-sm);
          margin-bottom: 16px;
        }
        .dm-auth-foot { margin-top: 24px; }
        .dm-auth-card .dm-btn-cta { width: 100%; margin-top: 8px; }
      `}</style>
    </div>
  );
}
