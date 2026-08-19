const API_BASE = () =>
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3010';

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
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function getApiBase() {
  return API_BASE();
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_APP_URL: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_MARKETPLACE_NAME?: string;
    readonly MODE: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
