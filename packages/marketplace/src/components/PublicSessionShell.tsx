import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentMeta, getAppLocale, setAppLocale, type AppLocale, type CompanyBrandingDto } from '@drivemarket/shared';

/**
 * Mobile-first shell for the public SMS-link flows (assisted session and
 * guarantor consent): dealer branding in the header, a language toggle, the
 * "Financing by Blox" footer with the link expiry, and the shared `dm-assist__*`
 * styles both pages are built from.
 */

export function isHexColour(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

/** CSS variables for the dealer's colours; empty when no valid hex colours are present. */
export function brandStyleFor(branding: CompanyBrandingDto | null | undefined): CSSProperties {
  const style: Record<string, string> = {};
  if (isHexColour(branding?.primary)) style['--dm-brand-primary'] = branding.primary.trim();
  if (isHexColour(branding?.accent)) style['--dm-brand-accent'] = branding.accent.trim();
  return style as CSSProperties;
}

type Props = {
  /** Browser tab title. */
  title: string;
  brandStyle?: CSSProperties;
  logoUrl?: string | null;
  /** Dealer display name; falls back to "Blox". */
  name?: string | null;
  tagline?: string | null;
  /** Pre-formatted "valid until" time; omitted when the link is finished. */
  validUntil?: string | null;
  children: ReactNode;
};

export function PublicSessionShell({ title, brandStyle, logoUrl, name, tagline, validUntil, children }: Props) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const displayName = name?.trim() || 'Blox';

  return (
    <div className="dm-assist" style={brandStyle}>
      <DocumentMeta title={title} />
      <header className="dm-assist__header">
        <div className="dm-assist__brand">
          {logoUrl ? (
            <img className="dm-assist__logo" src={logoUrl} alt={displayName} />
          ) : (
            <span className="dm-assist__logo dm-assist__logo--placeholder" aria-hidden>
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="dm-assist__brand-copy">
            <strong>{displayName}</strong>
            {tagline ? <span>{tagline}</span> : null}
          </div>
        </div>
        <div className="dm-assist__locale" role="group" aria-label={t('assistMode.customer.language')}>
          {(['en', 'ar'] as AppLocale[]).map((lang) => (
            <button
              key={lang}
              type="button"
              className={locale === lang ? 'is-active' : ''}
              aria-pressed={locale === lang}
              onClick={() => setAppLocale(lang)}
            >
              {lang === 'en' ? t('nav.localeEn') : t('nav.localeAr')}
            </button>
          ))}
        </div>
      </header>
      <main className="dm-assist__main">{children}</main>
      <footer className="dm-assist__footer">
        <span>{t('assistMode.customer.poweredBy')}</span>
        {validUntil ? <span>{t('assistMode.customer.validUntil', { time: validUntil })}</span> : null}
      </footer>
      <style>{PUBLIC_SESSION_CSS}</style>
    </div>
  );
}

/** Step markers shared by both flows. */
export function PublicSessionSteps({ steps, current, label }: { steps: Array<{ key: string; label: string }>; current: number; label: string }) {
  return (
    <ol className="dm-assist__steps" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`dm-assist__step${i < current ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="dm-assist__step-dot" aria-hidden>
            {i < current ? '✓' : i + 1}
          </span>
          <span className="dm-assist__step-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export const PUBLIC_SESSION_CSS = `
  .dm-assist {
    --dm-assist-primary: var(--dm-brand-primary, var(--dm-graphite-900));
    --dm-assist-accent: var(--dm-brand-accent, var(--dm-steel));
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--dm-canvas);
    color: var(--dm-ink);
  }
  .dm-assist__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    background: var(--dm-assist-primary);
    color: #fff;
  }
  .dm-assist__brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .dm-assist__logo {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    object-fit: cover;
    background: #fff;
    flex-shrink: 0;
  }
  .dm-assist__logo--placeholder {
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.16);
    font-family: var(--dm-font-display);
    font-weight: 700;
    font-size: 1.2rem;
  }
  .dm-assist__brand-copy { display: grid; gap: 2px; min-width: 0; }
  .dm-assist__brand-copy strong { font-family: var(--dm-font-display); font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-assist__brand-copy span { font-size: 12px; color: rgba(255,255,255,0.75); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-assist__locale { display: inline-flex; padding: 2px; border-radius: 8px; background: rgba(255,255,255,0.14); flex-shrink: 0; }
  .dm-assist__locale button {
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.8);
    min-height: 32px;
    padding: 0 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .dm-assist__locale button.is-active { background: #fff; color: var(--dm-assist-primary); }
  .dm-assist__main {
    flex: 1;
    width: 100%;
    max-width: 560px;
    margin-inline: auto;
    padding: 20px 16px 32px;
    box-sizing: border-box;
    display: grid;
    gap: 16px;
    align-content: start;
  }
  .dm-assist__intro h1,
  .dm-assist__card h1 {
    margin: 0 0 6px;
    font-family: var(--dm-font-display);
    font-size: 1.5rem;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dm-assist__intro > p { margin: 0; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__summary {
    margin: 14px 0 0;
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
  }
  .dm-assist__summary div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
  .dm-assist__summary dt { color: var(--dm-slate-600); }
  .dm-assist__summary dd { margin: 0; font-weight: 650; text-align: end; }
  .dm-assist__role {
    margin: 14px 0 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
    display: grid;
    gap: 4px;
  }
  .dm-assist__role strong { font-size: 14px; }
  .dm-assist__role p { margin: 0; font-size: 13px; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .dm-assist__step { display: grid; justify-items: center; gap: 6px; text-align: center; position: relative; }
  .dm-assist__step::before {
    content: '';
    position: absolute;
    top: 14px;
    inset-inline: 0;
    height: 2px;
    background: var(--dm-slate-200);
  }
  .dm-assist__step:first-child::before { inset-inline-start: 50%; }
  .dm-assist__step:last-child::before { inset-inline-end: 50%; }
  .dm-assist__step.is-done::before { background: var(--dm-assist-accent); }
  .dm-assist__step-dot {
    position: relative;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dm-surface);
    border: 2px solid var(--dm-slate-200);
    font-size: 12px;
    font-weight: 700;
    color: var(--dm-slate-600);
  }
  .dm-assist__step.is-current .dm-assist__step-dot { border-color: var(--dm-assist-primary); background: var(--dm-assist-primary); color: #fff; }
  .dm-assist__step.is-done .dm-assist__step-dot { border-color: var(--dm-assist-accent); background: var(--dm-assist-accent); color: #fff; }
  .dm-assist__step-label { font-size: 11px; font-weight: 600; color: var(--dm-slate-600); line-height: 1.25; }
  .dm-assist__step.is-current .dm-assist__step-label { color: var(--dm-ink); }
  .dm-assist__card {
    background: var(--dm-surface);
    border: 1px solid var(--dm-slate-200);
    border-radius: 16px;
    padding: 20px 18px;
    display: grid;
    gap: 12px;
  }
  .dm-assist__card h2 { margin: 0; font-family: var(--dm-font-display); font-size: 1.2rem; }
  .dm-assist__card--terminal p { margin: 0; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__step-of { margin: 0; font-size: 11px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dm-slate-600); }
  .dm-assist__muted { margin: 0; color: var(--dm-slate-600); line-height: 1.5; font-size: 14px; }
  .dm-assist__otp-label { font-size: 13px; font-weight: 650; color: var(--dm-slate-600); }
  .dm-assist__otp { display: flex; gap: 8px; justify-content: center; }
  .dm-assist__otp-box {
    width: 100%;
    max-width: 52px;
    min-height: 56px;
    padding: 0;
    border-radius: 10px;
    border: 1.5px solid var(--dm-slate-200);
    background: var(--dm-surface);
    font: inherit;
    font-family: var(--dm-font-display);
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    color: var(--dm-ink);
    box-sizing: border-box;
  }
  .dm-assist__otp-box.is-filled { border-color: var(--dm-assist-primary); }
  .dm-assist__otp-box:focus { outline: 2px solid var(--dm-assist-accent); outline-offset: 1px; }
  .dm-assist__otp-box:disabled { opacity: 0.6; }
  .dm-assist__notice {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }
  .dm-assist__notice--ok { background: var(--dm-success-soft); color: var(--dm-ink); }
  .dm-assist__notice--warn { background: var(--dm-warning-soft, #fff4e0); color: var(--dm-warning, #c47a00); }
  .dm-assist__notice--error { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
  .dm-assist__actions { display: grid; gap: 10px; }
  .dm-assist__cta { width: 100%; min-height: 50px !important; font-size: 1rem !important; text-decoration: none; }
  .dm-assist__cta:disabled { opacity: 0.5; cursor: not-allowed; }
  .dm-assist__link-btn {
    background: none;
    border: 1.5px solid var(--dm-slate-200);
    border-radius: 10px;
    min-height: 44px;
    padding: 0 14px;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 650;
    color: var(--dm-ink);
    cursor: pointer;
  }
  .dm-assist__link-btn:hover:not(:disabled) { border-color: var(--dm-assist-accent); }
  .dm-assist__link-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .dm-assist__consents { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .dm-assist__consent {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--dm-slate-200);
    background: var(--dm-canvas);
  }
  .dm-assist__consent.is-agreed { border-color: var(--dm-assist-accent); background: var(--dm-surface); }
  .dm-assist__consent-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .dm-assist__consent-head strong { font-size: 14px; line-height: 1.35; }
  .dm-assist__consent-required { flex-shrink: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dm-slate-600); padding: 3px 7px; border-radius: 999px; background: var(--dm-surface); border: 1px solid var(--dm-slate-200); }
  .dm-assist__consent p { margin: 0; font-size: 13px; color: var(--dm-slate-600); line-height: 1.5; }
  .dm-assist__consent-toggle {
    justify-self: start;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    color: var(--dm-steel);
    text-decoration: underline;
    cursor: pointer;
  }
  .dm-assist__consent-body { display: grid; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--dm-surface); border: 1px solid var(--dm-slate-200); max-height: 260px; overflow: auto; }
  .dm-assist__consent-body p { color: var(--dm-ink); }
  .dm-assist__check { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 650; cursor: pointer; }
  .dm-assist__check input { width: 20px; height: 20px; flex-shrink: 0; }
  .dm-assist__missing { font-weight: 600; }
  .dm-assist__fineprint { margin: 0; font-size: 12px; color: var(--dm-slate-600); line-height: 1.45; }
  .dm-assist__done { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 12px 0; }
  .dm-assist__done-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dm-success-soft);
    color: var(--dm-success);
    font-size: 2rem;
    font-weight: 700;
  }
  .dm-assist__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px 16px;
    padding: 12px 18px 20px;
    font-size: 12px;
    color: var(--dm-slate-600);
  }
  @media (min-width: 640px) {
    .dm-assist__header { padding: 16px 28px; }
    .dm-assist__main { padding: 28px 16px 40px; }
    .dm-assist__card { padding: 24px; }
    .dm-assist__actions { grid-template-columns: 1fr auto; align-items: center; }
    .dm-assist__actions .dm-assist__cta { grid-column: 1 / -1; }
    .dm-assist__actions .dm-assist__link-btn { grid-column: 1 / -1; justify-self: center; border: none; }
  }
`;
