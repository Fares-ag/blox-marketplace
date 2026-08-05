import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brandMeta } from '../config/brand-tokens';
import { useAuthStore } from '../auth/auth-store';

export function MoneyText({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`dm-money ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}

export function MarketplaceTopNav() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <header className="dm-topnav">
      <Link to="/" className="dm-topnav__brand">
        {brandMeta.name}
      </Link>
      <nav className="dm-topnav__links">
        <Link to="/vehicles">Vehicles</Link>
        <Link to="/help">Help</Link>
        {user ? (
          <>
            <Link to="/app/dashboard">Account</Link>
            <button type="button" className="dm-topnav__textbtn" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth/login">Sign in</Link>
        )}
      </nav>
      <style>{`
        .dm-topnav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 16px 24px;
          position: absolute;
          inset-inline: 0;
          top: 0;
          z-index: 10;
          color: #fff;
        }
        .dm-topnav__brand {
          font-family: var(--dm-font-display);
          font-size: 1.35rem;
          font-weight: 600;
          color: #fff;
          text-decoration: none;
        }
        .dm-topnav__links {
          display: flex;
          gap: 20px;
          align-items: center;
          font-size: 0.95rem;
        }
        .dm-topnav__links a { color: rgba(255,255,255,0.92); text-decoration: none; }
        .dm-topnav__textbtn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.92);
          font: inherit;
          cursor: pointer;
        }
      `}</style>
    </header>
  );
}

export function OpsShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: { to: string; label: string }[];
  children: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="dm-ops">
      <aside className="dm-ops__nav">
        <div className="dm-ops__brand">{brandMeta.name}</div>
        <div className="dm-ops__portal">{title}</div>
        <nav>
          {nav.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="dm-ops__user">
          <span>{user?.email}</span>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="dm-ops__main">{children}</main>
      <style>{`
        .dm-ops { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
        @media (max-width: 900px) { .dm-ops { grid-template-columns: 1fr; } }
        .dm-ops__nav {
          background: var(--dm-graphite-900);
          color: #fff;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dm-ops__brand { font-family: var(--dm-font-display); font-size: 1.4rem; font-weight: 600; }
        .dm-ops__portal { color: var(--dm-amber); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; }
        .dm-ops__nav a {
          display: block;
          color: rgba(255,255,255,0.85);
          text-decoration: none;
          padding: 10px 12px;
          border-radius: 8px;
          border-inline-start: 3px solid transparent;
        }
        .dm-ops__nav a:hover { background: var(--dm-graphite-800); border-inline-start-color: var(--dm-steel); }
        .dm-ops__user { margin-top: auto; padding-top: 24px; font-size: 0.8rem; color: var(--dm-slate-400); display: flex; flex-direction: column; gap: 8px; }
        .dm-ops__user button {
          background: transparent;
          border: 1px solid var(--dm-graphite-700);
          color: #fff;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
        }
        .dm-ops__main { padding: 32px; }
      `}</style>
    </div>
  );
}
