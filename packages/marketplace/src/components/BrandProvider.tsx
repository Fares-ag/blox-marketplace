/**
 * White-label context for dealer-branded customer entry (`/dealers/:code/*`).
 *
 * Loads the public company record (with `branding`) whenever the route carries
 * a dealer code, exposes it through `useBrand()`, and applies the dealer's
 * colours as CSS variables (`--dm-brand-primary`, `--dm-brand-accent`,
 * `--dm-brand-on-primary`, `--dm-brand-on-accent`) for as long as a branded
 * route is mounted. Everywhere else the variables are absent and the default
 * Blox look applies.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, type CompanyBrandingDto, type PublicCompany } from '@drivemarket/shared';

export type BrandedCompany = PublicCompany & {
  address?: string | null;
  contact_phone?: string | null;
  branding?: CompanyBrandingDto | null;
};

export type BrandContextValue = {
  branding: CompanyBrandingDto | null;
  companyCode: string | null;
  companyName: string | null;
  company: BrandedCompany | null;
  displayName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  primary: string | null;
  accent: string | null;
  /** True when a dealer route is active and the company resolved. */
  isBranded: boolean;
  isLoading: boolean;
  notFound: boolean;
};

const EMPTY: BrandContextValue = {
  branding: null,
  companyCode: null,
  companyName: null,
  company: null,
  displayName: null,
  tagline: null,
  logoUrl: null,
  primary: null,
  accent: null,
  isBranded: false,
  isLoading: false,
  notFound: false,
};

const BrandContext = createContext<BrandContextValue>(EMPTY);

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isSafeHexColour(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOUR.test(value.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Ink or white, whichever reads better on the given background (WCAG relative luminance). */
export function readableTextOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#0f3f45' : '#ffffff';
}

export function brandCodeFromPath(pathname: string): string | null {
  const match = matchPath({ path: '/dealers/:code', end: false }, pathname);
  const code = match?.params.code?.trim();
  return code ? code : null;
}

export function BrandProvider({ children, value }: { children: ReactNode; value?: Partial<BrandContextValue> }) {
  const location = useLocation();
  const code = value ? null : brandCodeFromPath(location.pathname);

  const query = useQuery({
    queryKey: ['company-by-code', code],
    queryFn: () => apiFetch<BrandedCompany | null>(`/api/companies/by-code/${encodeURIComponent(code!)}`),
    enabled: !!code,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const computed = useMemo<BrandContextValue>(() => {
    if (value) return { ...EMPTY, ...value };
    if (!code) return EMPTY;
    const company = query.data ?? null;
    const branding = company?.branding ?? null;
    const primary = isSafeHexColour(branding?.primary) ? branding!.primary!.trim() : null;
    const accent = isSafeHexColour(branding?.accent) ? branding!.accent!.trim() : null;
    return {
      branding,
      companyCode: code,
      companyName: company?.name ?? null,
      company,
      displayName: branding?.display_name?.trim() || company?.name || null,
      tagline: branding?.tagline?.trim() || null,
      logoUrl: branding?.logo_url?.trim() || company?.logo_url || null,
      primary,
      accent,
      isBranded: !!company,
      isLoading: query.isLoading,
      notFound: query.isSuccess && !company,
    };
  }, [value, code, query.data, query.isLoading, query.isSuccess]);

  useEffect(() => {
    if (!computed.isBranded) return;
    const root = document.documentElement;
    if (computed.primary) {
      root.style.setProperty('--dm-brand-primary', computed.primary);
      root.style.setProperty('--dm-brand-on-primary', readableTextOn(computed.primary));
    }
    if (computed.accent) {
      root.style.setProperty('--dm-brand-accent', computed.accent);
      root.style.setProperty('--dm-brand-on-accent', readableTextOn(computed.accent));
    }
    return () => {
      for (const name of ['--dm-brand-primary', '--dm-brand-on-primary', '--dm-brand-accent', '--dm-brand-on-accent']) {
        root.style.removeProperty(name);
      }
    };
  }, [computed.isBranded, computed.primary, computed.accent]);

  return <BrandContext.Provider value={computed}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}

/** Dealer logo + display name with the "Financing by Blox" attribution. */
export function BrandBadge({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const brand = useBrand();
  const { t } = useTranslation();
  if (!brand.isBranded) return null;
  const px = size === 'lg' ? 72 : size === 'sm' ? 36 : 52;
  return (
    <div className={`dm-brand-badge dm-brand-badge--${size}${className ? ` ${className}` : ''}`}>
      {brand.logoUrl ? (
        <img className="dm-brand-badge__logo" src={brand.logoUrl} alt={brand.displayName ?? ''} width={px} height={px} />
      ) : (
        <span className="dm-brand-badge__initial" style={{ width: px, height: px }} aria-hidden>
          {(brand.displayName ?? '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="dm-brand-badge__text">
        <span className="dm-brand-badge__name">{brand.displayName}</span>
        <span className="dm-brand-badge__powered">{t('whiteLabel.poweredBy')}</span>
      </div>
    </div>
  );
}
