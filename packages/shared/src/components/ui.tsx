import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { brandMeta } from '../config/brand-tokens';
import { bloxMeta } from '../config/blox-tokens';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale } from '../i18n';
import type { AppLocale } from '../i18n';

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

export function MarketplaceTopNav({ compareCount = 0 }: { compareCount?: number }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const locale = getAppLocale();

  function toggleLocale(next: AppLocale) {
    setAppLocale(next);
  }

  return (
    <header className="dm-topnav">
      <Link to="/" className="dm-topnav__brand">
        {bloxMeta.name}
      </Link>
      <nav className="dm-topnav__links">
        <Link to="/vehicles">{t('nav.vehicles')}</Link>
        <Link to="/dealers">{t('nav.dealers')}</Link>
        <Link to="/compare">
          {t('nav.compare')}
          {compareCount > 0 && <span className="dm-topnav__badge">{compareCount}</span>}
        </Link>
        <Link to="/help">{t('nav.help')}</Link>
        <div className="dm-topnav__locale">
          <button type="button" className={locale === 'en' ? 'is-active' : ''} onClick={() => toggleLocale('en')}>
            {t('nav.localeEn')}
          </button>
          <button type="button" className={locale === 'ar' ? 'is-active' : ''} onClick={() => toggleLocale('ar')}>
            {t('nav.localeAr')}
          </button>
        </div>
        {user ? (
          <>
            <Link to="/app/dashboard">{t('nav.account')}</Link>
            <button type="button" className="dm-topnav__textbtn" onClick={() => void signOut()}>
              {t('nav.signOut')}
            </button>
          </>
        ) : (
          <>
            <Link to="/auth/login">{t('nav.signIn')}</Link>
            <Link to="/auth/register">{t('nav.signUp')}</Link>
          </>
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
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          letter-spacing: -0.02em;
        }
        .dm-topnav__links {
          display: flex;
          gap: 20px;
          align-items: center;
          font-size: 0.95rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .dm-topnav__links a { color: rgba(255,255,255,0.92); text-decoration: none; }
        .dm-topnav__badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          margin-inline-start: 4px;
          border-radius: 999px;
          background: var(--dm-amber);
          color: var(--dm-ink);
          font-size: 11px;
          font-weight: 700;
        }
        .dm-topnav__textbtn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.92);
          font: inherit;
          cursor: pointer;
        }
        .dm-topnav__locale {
          display: inline-flex;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 999px;
          padding: 2px;
        }
        .dm-topnav__locale button {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.85);
          font: inherit;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.85rem;
        }
        .dm-topnav__locale button.is-active {
          background: rgba(0, 207, 162, 0.35);
          color: #fff;
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
