import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale } from '../i18n';
import type { AppLocale } from '../i18n';
import { BloxLogo } from './BloxLogo';

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

export function MarketplaceTopNav({
  compareCount = 0,
  variant = 'overlay',
}: {
  compareCount?: number;
  variant?: 'overlay' | 'solid';
}) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const locale = getAppLocale();
  const isSolid = variant === 'solid';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  function toggleLocale(next: AppLocale) {
    setAppLocale(next);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    setMenuOpen(false);
    const onBrowse = location.pathname === '/' || location.pathname === '/vehicles';
    if (onBrowse) {
      const next = new URLSearchParams(searchParams);
      if (trimmed) next.set('q', trimmed);
      else next.delete('q');
      next.delete('offset');
      const qs = next.toString();
      navigate(`/${qs ? `?${qs}` : ''}`);
      return;
    }
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    navigate(`/${params.toString() ? `?${params}` : ''}`);
  }

  const navLinks = (
    <>
      <Link to="/" onClick={() => setMenuOpen(false)}>{t('nav.vehicles')}</Link>
      <Link to="/dealers" onClick={() => setMenuOpen(false)}>{t('nav.dealers')}</Link>
      <Link to="/compare" onClick={() => setMenuOpen(false)}>
        {t('nav.compare')}
        {compareCount > 0 && <span className="dm-topnav__badge">{compareCount}</span>}
      </Link>
      <Link to="/help" onClick={() => setMenuOpen(false)}>{t('nav.help')}</Link>
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
          <Link to="/app/dashboard" onClick={() => setMenuOpen(false)}>{t('nav.account')}</Link>
          <Link to="/app/notifications" onClick={() => setMenuOpen(false)}>
            {t('notifications.title', { defaultValue: 'Notifications' })}
          </Link>
          <button type="button" className="dm-topnav__textbtn" onClick={() => void signOut()}>
            {t('nav.signOut')}
          </button>
        </>
      ) : (
        <>
          <Link to="/auth/login" onClick={() => setMenuOpen(false)}>{t('nav.signIn')}</Link>
          <Link to="/auth/register" onClick={() => setMenuOpen(false)}>{t('nav.signUp')}</Link>
        </>
      )}
    </>
  );

  return (
    <header className={`dm-topnav${isSolid ? ' dm-topnav--solid' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
      <Link to="/" className="dm-topnav__brand" aria-label="Blox home">
        <BloxLogo height={isSolid ? 26 : 30} tone={isSolid ? 'onLight' : 'onDark'} />
      </Link>
      <button
        type="button"
        className="dm-topnav__menu-btn"
        aria-expanded={menuOpen}
        aria-controls="dm-topnav-drawer"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className="dm-topnav__menu-icon" aria-hidden />
        <span className="dm-topnav__menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
      <form className="dm-topnav__search" onSubmit={onSearch} role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('vehicles.searchPlaceholder')}
          aria-label={t('vehicles.searchPlaceholder')}
        />
        <button type="submit" className="dm-topnav__search-btn" aria-label={t('home.search')}>
          <span className="dm-topnav__search-label">{t('home.search')}</span>
          <svg className="dm-topnav__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
      <nav className="dm-topnav__links dm-topnav__links--desktop" aria-label="Main">
        {navLinks}
      </nav>
      {menuOpen && (
        <button
          type="button"
          className="dm-topnav__backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <nav id="dm-topnav-drawer" className="dm-topnav__drawer" aria-label="Mobile menu">
        {navLinks}
      </nav>
      <style>{`
        .dm-topnav {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas:
            "brand menu"
            "search search";
          gap: 10px 12px;
          padding: 12px var(--blox-page-gutter, 24px);
          position: absolute;
          inset-inline: 0;
          top: 0;
          z-index: 20;
          color: #fff;
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }
        .dm-topnav--solid {
          position: sticky;
          background: var(--dm-surface);
          color: var(--dm-ink);
          border-bottom: 1px solid var(--dm-slate-200);
          box-shadow: 0 1px 0 rgba(22, 83, 91, 0.04);
        }
        .dm-topnav__brand {
          grid-area: brand;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          line-height: 0;
          flex-shrink: 0;
          min-width: 0;
        }
        .dm-topnav__menu-btn {
          grid-area: menu;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.1);
          color: inherit;
          border-radius: 8px;
          padding: 8px 12px;
          font: inherit;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          align-self: center;
        }
        .dm-topnav--solid .dm-topnav__menu-btn {
          border-color: var(--dm-slate-200);
          background: var(--dm-surface-muted, #e8f0f0);
          color: var(--dm-ink);
        }
        .dm-topnav__menu-icon {
          width: 16px;
          height: 2px;
          background: currentColor;
          position: relative;
          display: block;
        }
        .dm-topnav__menu-icon::before,
        .dm-topnav__menu-icon::after {
          content: '';
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          background: currentColor;
        }
        .dm-topnav__menu-icon::before { top: -5px; }
        .dm-topnav__menu-icon::after { top: 5px; }
        .dm-topnav__search {
          grid-area: search;
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.28);
          border-radius: 10px;
          overflow: hidden;
        }
        .dm-topnav--solid .dm-topnav__search {
          background: var(--dm-surface-muted, #e8f0f0);
          border-color: var(--dm-slate-200);
        }
        .dm-topnav__search input {
          flex: 1;
          min-width: 0;
          width: 100%;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 0.875rem;
          padding: 9px 12px;
          outline: none;
        }
        .dm-topnav__search input::placeholder {
          color: rgba(255,255,255,0.65);
        }
        .dm-topnav--solid .dm-topnav__search input::placeholder {
          color: var(--dm-slate-400, #8a9aa2);
        }
        .dm-topnav__search-btn {
          flex-shrink: 0;
          border: none;
          background: var(--dm-amber, #dbff00);
          color: var(--dm-ink, #16535b);
          font: inherit;
          font-size: 0.8125rem;
          font-weight: 700;
          padding: 9px 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .dm-topnav__search-btn:hover {
          background: var(--dm-amber-deep, #c8e600);
        }
        .dm-topnav__search-icon { display: none; }
        .dm-topnav__search-label { display: inline; }
        .dm-topnav__links {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 0.875rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 0;
        }
        .dm-topnav__links--desktop {
          grid-area: links;
          display: none;
        }
        .dm-topnav__links a { color: rgba(255,255,255,0.92); text-decoration: none; white-space: nowrap; }
        .dm-topnav--solid .dm-topnav__links a { color: var(--dm-ink); }
        .dm-topnav--solid .dm-topnav__links a:hover { color: var(--dm-steel); }
        .dm-topnav__backdrop {
          display: none;
          position: fixed;
          inset: 0;
          border: none;
          background: rgba(15, 63, 69, 0.45);
          z-index: 18;
          cursor: pointer;
        }
        .dm-topnav.is-menu-open .dm-topnav__backdrop { display: block; }
        .dm-topnav__drawer {
          display: none;
          flex-direction: column;
          gap: 4px;
          position: fixed;
          inset-inline: 0;
          top: 0;
          max-height: 85vh;
          overflow: auto;
          padding: 72px 16px 20px;
          background: var(--dm-graphite-900, #16535b);
          color: #fff;
          z-index: 19;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
        }
        .dm-topnav.is-menu-open .dm-topnav__drawer { display: flex; }
        .dm-topnav--solid .dm-topnav__drawer {
          background: var(--dm-surface);
          color: var(--dm-ink);
          border-bottom: 1px solid var(--dm-slate-200);
        }
        .dm-topnav__drawer a {
          color: inherit;
          text-decoration: none;
          padding: 12px 10px;
          border-radius: 8px;
          font-weight: 500;
        }
        .dm-topnav__drawer a:hover { background: rgba(255,255,255,0.08); }
        .dm-topnav--solid .dm-topnav__drawer a:hover { background: var(--dm-surface-muted); }
        .dm-topnav__drawer .dm-topnav__locale { margin-top: 8px; align-self: flex-start; }
        .dm-topnav__drawer .dm-topnav__textbtn {
          text-align: start;
          padding: 12px 10px;
          color: inherit;
        }
        .dm-topnav.is-menu-open .dm-topnav__brand,
        .dm-topnav.is-menu-open .dm-topnav__menu-btn {
          position: relative;
          z-index: 21;
        }
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
          white-space: nowrap;
        }
        .dm-topnav--solid .dm-topnav__textbtn { color: var(--dm-ink); }
        .dm-topnav__locale {
          display: inline-flex;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 999px;
          padding: 2px;
          flex-shrink: 0;
        }
        .dm-topnav--solid .dm-topnav__locale { border-color: var(--dm-slate-200); }
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
        .dm-topnav--solid .dm-topnav__locale button { color: var(--dm-slate-600); }
        .dm-topnav__locale button.is-active {
          background: rgba(0, 207, 162, 0.35);
          color: #fff;
        }
        .dm-topnav--solid .dm-topnav__locale button.is-active {
          background: var(--dm-steel-soft);
          color: var(--dm-ink);
        }

        /* Tablet: brand + search + menu on one row */
        @media (min-width: 901px) {
          .dm-topnav {
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas: "brand search menu";
            gap: 12px 16px;
            align-items: center;
          }
          .dm-topnav__search-label { display: inline; }
          .dm-topnav__search-icon { display: none; }
        }

        /* Desktop: inline nav links, no hamburger */
        @media (min-width: 1200px) {
          .dm-topnav {
            grid-template-columns: auto minmax(240px, 440px) minmax(0, 1fr);
            grid-template-areas: "brand search links";
            max-width: min(100%, var(--bp-content-max, 1600px));
            margin-inline: auto;
            width: 100%;
          }
          .dm-topnav__menu-btn { display: none !important; }
          .dm-topnav__links--desktop { display: flex; }
          .dm-topnav__backdrop,
          .dm-topnav__drawer { display: none !important; }
        }
        @media (min-width: 1600px) {
          .dm-topnav {
            max-width: min(100%, var(--bp-content-wide, 2000px));
          }
        }
        @media (min-width: 1920px) {
          .dm-topnav { max-width: min(100%, var(--bp-content-ultra, 2560px)); }
        }
        @media (min-width: 2560px) {
          .dm-topnav { max-width: min(100%, 2800px); }
        }

        /* Phone: icon-only search button */
        @media (max-width: 900px) {
          .dm-topnav__search-label { display: none; }
          .dm-topnav__search-icon { display: block; }
          .dm-topnav__search-btn { padding: 9px 12px; }
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
        <div className="dm-ops__brand">
          <BloxLogo height={26} tone="onDark" />
        </div>
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
