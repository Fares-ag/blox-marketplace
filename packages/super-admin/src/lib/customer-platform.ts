/**
 * Data helpers for the customer-platform admin features: branches, finance providers,
 * branding links and the origination funnel. Pure functions plus thin react-query hooks.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@drivemarket/shared';
import type { BranchDto, CompanyRow, FinancePartnerAdminDto, FunnelPeriodPreset } from '../types';

const DEFAULT_MARKETPLACE_ORIGIN = 'https://www.blox.market';
const DEV_MARKETPLACE_ORIGIN = 'http://localhost:5173';

/** Origin of the customer marketplace, used for the branded entry link. */
export function marketplaceOrigin(): string {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const configured = typeof env.VITE_MARKETPLACE_URL === 'string' ? env.VITE_MARKETPLACE_URL.trim() : '';
  if (configured) return configured.replace(/\/+$/, '');
  return import.meta.env.DEV ? DEV_MARKETPLACE_ORIGIN : DEFAULT_MARKETPLACE_ORIGIN;
}

/** `${marketplace}/dealers/<code>/apply`, or null when the company has no code yet. */
export function customerEntryLink(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  return `${marketplaceOrigin()}/dealers/${encodeURIComponent(trimmed)}/apply`;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Accepts `abc`, `#abc`, `aabbcc`; returns `#AABBCC`. Leaves anything else untouched. */
export function normaliseHex(value: string): string {
  const raw = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return value;
}

export const BLOX_BRAND_DEFAULTS = { primary: '#16535B', accent: '#00CFA2' } as const;

/** Company query keys used across both ops portals; invalidating an absent key is a no-op. */
const COMPANY_QUERY_KEYS = [
  'admin-companies',
  'sa-companies',
  'admin-companies-mini',
  'sa-companies-mini',
  'companies-mini',
  'companies-mini-funnel',
  'company-detail',
  'company-branding',
];

export function invalidateCompanyQueries(qc: QueryClient) {
  for (const key of COMPANY_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key] });
}

export function companyBranchesKey(companyId: string) {
  return ['company-branches', companyId] as const;
}

export function useCompanyBranches(companyId: string | null | undefined) {
  return useQuery({
    queryKey: companyBranchesKey(companyId ?? ''),
    queryFn: () => apiFetch<BranchDto[]>(`/api/companies/${companyId}/branches`),
    enabled: !!companyId,
  });
}

export const FINANCE_PROVIDERS_KEY = ['finance-providers'];

/** `GET /api/finance-partners` — tolerates both a bare array and the paginated envelope. */
export async function fetchFinanceProviders(): Promise<FinancePartnerAdminDto[]> {
  const res = await apiFetch<FinancePartnerAdminDto[] | { items?: FinancePartnerAdminDto[] }>(
    '/api/finance-partners?limit=100&offset=0',
  );
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

export function useFinanceProviders() {
  return useQuery({ queryKey: FINANCE_PROVIDERS_KEY, queryFn: fetchFinanceProviders });
}

const COMPANY_PAGE_SIZE = 100;

/** There is no `GET /api/companies/:id`; page through the admin list until the id is found. */
export async function fetchCompanyById(id: string): Promise<CompanyRow | null> {
  let offset = 0;
  for (;;) {
    const page = await apiFetch<{ total: number; items: CompanyRow[] }>(
      `/api/companies/all?limit=${COMPANY_PAGE_SIZE}&offset=${offset}`,
    );
    const hit = page.items.find((c) => c.id === id);
    if (hit) return hit;
    offset += COMPANY_PAGE_SIZE;
    if (page.items.length === 0 || offset >= page.total) return null;
  }
}

export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function funnelPeriodRange(
  preset: Exclude<FunnelPeriodPreset, 'custom'>,
  now: Date = new Date(),
): { from: string; to: string } {
  const to = toYmd(now);
  if (preset === 'thisMonth') {
    return { from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  const days = preset === 'last7' ? 7 : preset === 'last30' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return { from: toYmd(start), to };
}

export const APPROVAL_TARGET_HOURS = 24;

export function formatRate(rate: number | null | undefined, locale: string): string {
  if (rate == null || Number.isNaN(rate)) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(rate);
}

export function formatHours(hours: number | null | undefined, locale: string): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours);
}

export function formatCount(value: number | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

/** Machine code from an API error (`branch_code_exists`, ...) or the message when there is none. */
export function apiErrorCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && error.code !== 'request_failed') return error.code;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
