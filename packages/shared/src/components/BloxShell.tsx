import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale, type AppLocale } from '../i18n';
import '../styles/blox-ops.scss';
import { BloxLogo } from './BloxLogo';

export interface BloxNavItem {
  to: string;
  label: string;
  icon?: 'home' | 'inventory' | 'apps' | 'company' | 'quotes' | 'queue' | 'users' | 'logs' | 'system' | 'finance' | 'offers' | 'products' | 'ledgers';
}

interface BloxShellProps {
  title: string;
  nav: BloxNavItem[];
  children: ReactNode;
  /** Paths that should also match the root `/` as active */
  homePaths?: string[];
}

function NavIcon({ kind }: { kind: NonNullable<BloxNavItem['icon']> }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5z" />
        </svg>
      );
    case 'inventory':
    case 'products':
      return (
        <svg {...common}>
          <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case 'apps':
    case 'queue':
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'company':
      return (
        <svg {...common}>
          <path d="M4 20V9l8-5 8 5v11" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'quotes':
    case 'offers':
      return (
        <svg {...common}>
          <path d="M7 7h10v10H7z" />
          <path d="M10 11h4M12 9v4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <path d="M16 8a3 3 0 1 1 0 6" />
          <path d="M19 19c0-2-1.5-3.5-3.5-4" />
        </svg>
      );
    case 'logs':
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h8" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case 'system':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case 'finance':
    case 'ledgers':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18M8 14h4" />
        </svg>
      );
    default:
      return null;
  }
}

export function BloxShell({ title, nav, children, homePaths = ['/'] }: BloxShellProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const locale = getAppLocale();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

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
    <div className={`blox-ops blox-shell${navOpen ? ' is-nav-open' : ''}`}>
      <button
        type="button"
        className="blox-shell__menu-btn"
        aria-expanded={navOpen}
        aria-controls="blox-ops-nav"
        onClick={() => setNavOpen((v) => !v)}
      >
        <span className="blox-shell__menu-icon" aria-hidden />
        {t('ops.shell.menu')}
      </button>
      {navOpen && (
        <button
          type="button"
          className="blox-shell__backdrop"
          aria-label={t('ops.shell.closeMenu')}
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside id="blox-ops-nav" className="blox-shell__nav">
        <div className="blox-shell__brand-row">
          <div>
            <BloxLogo height={28} tone="onDark" className="blox-shell__logo" />
            <div className="blox-shell__portal">{title}</div>
          </div>
        </div>
        <nav className="blox-shell__links">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item.to) ? 'is-active' : undefined}
              onClick={() => setNavOpen(false)}
            >
              {item.icon && (
                <span className="blox-shell__nav-icon">
                  <NavIcon kind={item.icon} />
                </span>
              )}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="blox-shell__user">
          <div className="blox-shell__locale">
            <button
              type="button"
              className={locale === 'en' ? 'is-active' : undefined}
              onClick={() => setAppLocale('en' as AppLocale)}
            >
              {t('nav.localeEn')}
            </button>
            <button
              type="button"
              className={locale === 'ar' ? 'is-active' : undefined}
              onClick={() => setAppLocale('ar' as AppLocale)}
            >
              {t('nav.localeAr')}
            </button>
          </div>
          <div className="blox-shell__user-meta">
            <span className="blox-shell__user-email">{user?.email ?? '—'}</span>
            {user?.role && <span className="blox-shell__role">{user.role.replace(/_/g, ' ')}</span>}
          </div>
          <button type="button" onClick={() => void signOut()}>
            {t('ops.shell.signOut')}
          </button>
        </div>
      </aside>
      <main className="blox-shell__main">{children}</main>
    </div>
  );
}
