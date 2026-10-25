import { IDEMPOTENCY_KEY_HEADER, parseApiErrorBody } from './api-errors';

const LOCAL_API_FALLBACK = 'http://localhost:3011';

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV) return LOCAL_API_FALLBACK;
  throw new Error(
    'VITE_API_URL is required in production builds. Configure it in the deployment environment.',
  );
}

let cachedApiBase: string | null = null;

const API_BASE = () => {
  if (!cachedApiBase) cachedApiBase = resolveApiBase();
  return cachedApiBase;
};

/** Fail fast at app startup when a prod build has no API URL configured. */
export function assertApiBaseConfigured(): void {
  void API_BASE();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    /** Structured context from the API error envelope (`missing`, `application_id`, `remaining`, …). */
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function envelopeDetails(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const error = (data as { error?: unknown }).error;
  const details =
    error && typeof error === 'object' ? (error as { details?: unknown }).details : (data as { details?: unknown }).details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined;
}

let onUnauthorized: (() => void) | null = null;
let handlingUnauthorized = false;

/** Registered once by the auth store — clears session and redirects on 401. */
export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/** Reset after handler early-return (e.g. already on /auth/*) so later 401s are handled. */
export function resetUnauthorizedLatch() {
  handlingUnauthorized = false;
}

function triggerUnauthorized() {
  if (handlingUnauthorized || !onUnauthorized) return;
  handlingUnauthorized = true;
  onUnauthorized();
}

function resolveApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Better Auth + neutral health probes are not URI-versioned.
  if (
    normalized.startsWith('/api/v1/') ||
    normalized === '/api/v1' ||
    normalized.startsWith('/api/auth/') ||
    normalized.startsWith('/api/health')
  ) {
    return normalized;
  }
  if (normalized.startsWith('/api/')) {
    return `/api/v1${normalized.slice('/api'.length)}`;
  }
  return normalized;
}

export type ApiFetchOptions = {
  /** Replays the same response for duplicate POSTs (application create, payments, etc.). */
  idempotencyKey?: string;
};

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.idempotencyKey?.trim()) {
    headers.set(IDEMPOTENCY_KEY_HEADER, options.idempotencyKey.trim());
  }

  const resolvedPath = resolveApiPath(path);
  const res = await fetch(`${API_BASE()}${resolvedPath}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let code = 'request_failed';
    let message = res.statusText || 'Request failed';
    let details: Record<string, unknown> | undefined;
    try {
      const data = await res.json();
      const parsed = parseApiErrorBody(data, res.status);
      code = parsed.code;
      message = parsed.message;
      details = envelopeDetails(data);
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      // /api/me is the session probe — 401 means guest, not "force login".
      if (!resolvedPath.endsWith('/me') && !path.endsWith('/me')) {
        triggerUnauthorized();
      }
    }
    throw new ApiError(message, res.status, code, details);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('blox:api-activity'));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getApiBase() {
  return API_BASE();
}

/** Absolute API URL with `/api/v1` normalization (for fetch, downloads, file links). */
export function apiUrl(path: string): string {
  return `${API_BASE()}${resolveApiPath(path)}`;
}

import { listingImageMediaPath } from './listing-image-url';

/** Listing image path/URL from API → absolute URL for `<img src>` (ops portals run on a different origin than the API). */
export function resolveListingImageUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();
  const proxyPath = listingImageMediaPath(trimmed);
  if (proxyPath) return `${API_BASE()}${proxyPath}`;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_BASE()}${trimmed}`;
  return trimmed;
}

/** File download route under `/api/v1/...` (path may omit `/api`). */
export function apiFileUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) {
    return apiUrl(normalized);
  }
  return `${API_BASE()}/api/v1${normalized}`;
}

function parseContentDispositionFilename(header: string | null): string | undefined {
  if (!header) return undefined;
  const star = header.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain?.[1];
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Authenticated download for cross-origin API file routes (dealer/credit portals). */
export async function downloadApiFile(path: string, fallbackFilename = 'download'): Promise<void> {
  const base = apiFileUrl(path);
  const url = `${base}${base.includes('?') ? '&' : '?'}disposition=attachment`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    let message = 'Download failed';
    try {
      const data = await res.json();
      message = parseApiErrorBody(data, res.status).message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      triggerUnauthorized();
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const filename = parseContentDispositionFilename(res.headers.get('Content-Disposition')) || fallbackFilename;
  triggerFileDownload(blob, filename);
}

/** Open a file route in a new tab with session cookies (works across portal/API origins). */
export async function openApiFileInNewTab(path: string): Promise<void> {
  const base = apiFileUrl(path);
  const url = `${base}${base.includes('?') ? '&' : '?'}disposition=inline`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) triggerUnauthorized();
    throw new ApiError('Could not open file', res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export const DEFAULT_PAGE_SIZE = 50;

export function buildPaginationQuery(page: number, pageSize = DEFAULT_PAGE_SIZE): string {
  return `limit=${pageSize}&offset=${page * pageSize}`;
}

export function paginationWindow(total: number, page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return { from, to, total };
}
