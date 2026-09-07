/**
 * White-label context for dealer-branded customer journeys.
 *
 * The brand activates from three sources, in this order of precedence:
 *   1. the route carries a dealer code (`/dealers/:code/*` — showroom, branded entry);
 *   2. a stored code (`sessionStorage['dm-brand-code']`, set when the customer
 *      arrives through `/dealers/:code/apply` and cleared on sign-out), which keeps
 *      the dealer's look through the stepper, dashboard and detail pages;
 *   3. on a vehicle page, only when that vehicle's `company.code` matches the
 *      stored code — another dealer's car never wears the wrong brand.
 *
 * `useBrand()` exposes the resolved branding; the provider applies the colours
 * as CSS variables (`--dm-brand-primary`, `--dm-brand-accent`,
 * `--dm-brand-on-primary`, `--dm-brand-on-accent`) while a brand is active.
 * Everywhere else the variables are absent and the default Blox look applies.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, useAuthStore, type CompanyBrandingDto, type PublicCompany } from '@drivemarket/shared';
import { clearStoredBrandCode, readStoredBrandCode, storeBrandCode } from '../lib/brand-storage';

export type BrandedCompany = PublicCompany & {
  address?: string | null;
  contact_phone?: string | null;
  branding?: CompanyBrandingDto | null;
};

export type BrandSource = 'route' | 'stored' | null;

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
  /** True when a dealer route or stored entry is active and the company resolved. */
  isBranded: boolean;
  isLoading: boolean;
  notFound: boolean;
  /** Where the active brand came from. */
  source: BrandSource;
  /**
   * Pages about one specific dealer (vehicle detail) declare it here so a
   * stored brand only shows when the codes match. `undefined` = page is not
   * dealer-specific; `null` = dealer-specific but not known yet.
   */
  setPageCompanyCode: (code: string | null | undefined) => void;
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
  source: null,
  setPageCompanyCode: () => {},
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

/** True on the branded entry page, the only route that persists the brand for the visit. */
export function isBrandedEntryPath(pathname: string): boolean {
  return !!matchPath({ path: '/dealers/:code/apply', end: true }, pathname);
}

function sameCode(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function BrandProvider({ children, value }: { children: ReactNode; value?: Partial<BrandContextValue> }) {
  const location = useLocation();
  const routeCode = value ? null : brandCodeFromPath(location.pathname);
  const [storedCode, setStoredCode] = useState<string | null>(() => readStoredBrandCode());
  const [pageCompanyCode, setPageCompanyCodeState] = useState<string | null | undefined>(undefined);

  // Arriving through the branded entry keeps the dealer's look for the rest of the visit.
  useEffect(() => {
    if (routeCode && isBrandedEntryPath(location.pathname)) {
      storeBrandCode(routeCode);
      setStoredCode(routeCode);
    }
  }, [routeCode, location.pathname]);

  // Signing out ends the branded visit (the auth store is shared code; we only listen).
  useEffect(
    () =>
      useAuthStore.subscribe((state, prev) => {
        if (prev.user && !state.user) {
          clearStoredBrandCode();
          setStoredCode(null);
        }
      }),
    [],
  );

  const setPageCompanyCode = useCallback((code: string | null | undefined) => {
    setPageCompanyCodeState(code);
  }, []);

  const storedApplies = !!storedCode && (pageCompanyCode === undefined || sameCode(pageCompanyCode, storedCode));
  const code = value ? null : routeCode ?? (storedApplies ? storedCode : null);
  const source: BrandSource = routeCode ? 'route' : code ? 'stored' : null;

  const query = useQuery({
    queryKey: ['company-by-code', code],
    queryFn: () => apiFetch<BrandedCompany | null>(`/api/companies/by-code/${encodeURIComponent(code!)}`),
    enabled: !!code,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // A stored code that no longer resolves (dealer link deactivated) is dropped.
  useEffect(() => {
    if (source === 'stored' && query.isSuccess && !query.data) {
      clearStoredBrandCode();
      setStoredCode(null);
    }
  }, [source, query.isSuccess, query.data]);

  const computed = useMemo<BrandContextValue>(() => {
    if (value) return { ...EMPTY, ...value, setPageCompanyCode };
    if (!code) return { ...EMPTY, setPageCompanyCode };
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
      source: company ? source : null,
      setPageCompanyCode,
    };
  }, [value, code, source, query.data, query.isLoading, query.isSuccess, setPageCompanyCode]);

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

/**
 * Declares the dealer a page is about (vehicle detail) so a stored brand only
 * shows when the codes match. Pass `null` while the page's company is loading.
 */
export function useBrandPageScope(companyCode: string | null): void {
  const { setPageCompanyCode } = useBrand();
  useEffect(() => {
    setPageCompanyCode(companyCode);
    return () => setPageCompanyCode(undefined);
  }, [companyCode, setPageCompanyCode]);
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
