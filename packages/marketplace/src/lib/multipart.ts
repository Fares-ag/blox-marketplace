import { apiUrl } from '@drivemarket/shared';

export type ParsedErrorBody = {
  /** Machine code (`otp_invalid`, `documents_missing`, …) or a generic fallback. */
  code: string;
  message: string;
  /** Full JSON body so callers can read structured extras (`remaining`, `missing`, …). */
  body: Record<string, unknown> | null;
};

/**
 * Reads a failed API response the way `apiFetch` does, but keeps the raw body
 * so structured fields the API attaches to an error are not lost.
 */
export async function readErrorBody(res: Response): Promise<ParsedErrorBody> {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = (await res.json()) as unknown;
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  let code = '';
  const err = body?.error;
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).code === 'string') {
    code = String((err as Record<string, unknown>).code);
  } else if (typeof err === 'string' && /^[a-z][a-z0-9_]*$/.test(err)) {
    code = err;
  } else if (typeof body?.message === 'string' && /^[a-z][a-z0-9_]*$/.test(body.message)) {
    code = body.message;
  } else if (Array.isArray(body?.message)) {
    code = 'validation_failed';
  }
  if (!code) code = res.status === 409 ? 'conflict' : res.status === 400 ? 'bad_request' : 'request_failed';
  const message =
    typeof body?.message === 'string' && body.message.trim() ? body.message : res.statusText || code;
  return { code, message, body };
}

export class MultipartError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = 'MultipartError';
  }
}

/** Multipart upload to the API (`credentials: include`, `/api/v1` normalisation, structured errors). */
export async function uploadMultipart<T = unknown>(
  path: string,
  form: FormData,
  init: { method?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: init.method ?? 'POST',
    credentials: 'include',
    headers: init.headers,
    body: form,
  });
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    throw new MultipartError(parsed.message, res.status, parsed.code);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
