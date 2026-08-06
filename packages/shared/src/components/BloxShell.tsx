import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth/auth-store';
import { bloxMeta } from '../config/blox-tokens';
import '../styles/blox-ops.scss';

export interface BloxNavItem {
  to: string;
  label: string;
}

interface BloxShellProps {
  title: string;
  nav: BloxNavItem[];
  children: ReactNode;
  /** Paths that should also match the root `/` as active */
  homePaths?: string[];
}

export function BloxShell({ title, nav, children, homePaths = ['/'] }: BloxShellProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  function isActive(path: string) {
    if (homePaths.includes(path)) {
      return location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));
    }
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <div className="blox-ops blox-shell">
      <aside className="blox-shell__nav">
        <div className="blox-shell__brand">{bloxMeta.name}</div>
        <div className="blox-shell__portal">{title}</div>
        <nav className="blox-shell__links">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item.to) ? 'is-active' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="blox-shell__user">
          <span>{user?.email}</span>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="blox-shell__main">{children}</main>
    </div>
  );
}
