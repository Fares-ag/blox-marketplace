const LOCAL_API_FALLBACK = 'http://localhost:3010';

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
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let code = 'request_failed';
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[]; error?: string };
      if (Array.isArray(data.message)) message = data.message.join(', ');
      else if (typeof data.message === 'string') {
        message = data.message;
        code = data.message;
      }
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      // /api/me is the session probe — 401 means guest, not "force login".
      if (path !== '/api/me' && !path.endsWith('/me')) {
        triggerUnauthorized();
      }
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getApiBase() {
  return API_BASE();
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
