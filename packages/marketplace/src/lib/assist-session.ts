import { apiUrl, type AssistedSessionPublicDto, type AssistedSessionStatusDto } from '@drivemarket/shared';
import { readErrorBody } from './multipart';

/**
 * Customer side of an assisted (walk-in) session. Public routes, no cookie
 * session: after the OTP is verified the API hands back a `proof` that must be
 * echoed as `x-assist-proof` on every later call. It lives in sessionStorage so
 * a page refresh on the same device does not force a second OTP.
 */

export const ASSIST_PROOF_HEADER = 'x-assist-proof';
const PROOF_PREFIX = 'blox-assist-proof:';

export function readAssistProof(token: string): string | null {
  try {
    return sessionStorage.getItem(PROOF_PREFIX + token);
  } catch {
    return null;
  }
}

export function storeAssistProof(token: string, proof: string): void {
  try {
    sessionStorage.setItem(PROOF_PREFIX + token, proof);
  } catch {
    /* private mode / storage blocked: the proof only lives in memory for this page */
  }
}

export function clearAssistProof(token: string): void {
  try {
    sessionStorage.removeItem(PROOF_PREFIX + token);
  } catch {
    /* ignore */
  }
}

export class AssistApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    /** Attempts left after a wrong code (`otp_invalid`). */
    public remaining: number | null = null,
    /** Seconds until the lock/resend budget clears (`otp_locked`, resend 429). */
    public retryAfterSec: number | null = null,
  ) {
    super(message);
    this.name = 'AssistApiError';
  }
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Machine codes A2 emits on the public assist routes. */
export const ASSIST_ERROR_CODES = {
  otpInvalid: 'otp_invalid',
  otpLocked: 'otp_locked',
  otpExpired: 'otp_expired',
  proofMissing: 'assist_proof_missing',
  proofInvalid: 'assist_proof_invalid',
  sessionExpired: 'assist_session_expired',
  sessionClosed: 'assist_session_closed',
  consentsRequired: 'consents_required',
} as const;

async function assistRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  withProof = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (withProof) {
    const proof = readAssistProof(token);
    if (!proof) throw new AssistApiError('assist_proof_missing', 0, 'assist_proof_missing');
    headers.set(ASSIST_PROOF_HEADER, proof);
  }
  const res = await fetch(apiUrl(`/api/assist/${encodeURIComponent(token)}${path}`), {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const parsed = await readErrorBody(res);
    const body = parsed.body ?? {};
    // Envelope: `{ error: { code, message, requestId, details? } }` — structured extras such as
    // `remaining` / `retry_after_sec` live under `error.details`; older shapes are read as fallbacks.
    const nested = asRecord(body.error);
    const lookup = (key: string) =>
      asRecord(nested.details)[key] ?? asRecord(body.details)[key] ?? nested[key] ?? body[key];
    throw new AssistApiError(
      parsed.message,
      res.status,
      parsed.code,
      numberOrNull(lookup('remaining')),
      numberOrNull(lookup('retry_after_sec')),
    );
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function fetchAssistSession(token: string): Promise<AssistedSessionPublicDto> {
  return assistRequest<AssistedSessionPublicDto>(token, '', { method: 'GET' });
}

export function verifyAssistOtp(
  token: string,
  code: string,
): Promise<{ proof: string; status: AssistedSessionStatusDto }> {
  return assistRequest(token, '/otp/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export function resendAssistOtp(
  token: string,
): Promise<{ status?: string; otp_expires_in_sec?: number; retry_after_sec?: number } | undefined> {
  return assistRequest(token, '/otp/resend', { method: 'POST' });
}

export function submitAssistConsents(
  token: string,
  acceptances: Array<{ code: string; version: string }>,
  locale: 'en' | 'ar',
): Promise<{ status?: AssistedSessionStatusDto } | undefined> {
  return assistRequest(
    token,
    '/consents',
    { method: 'POST', body: JSON.stringify({ acceptances, locale }) },
    true,
  );
}

export function startAssistIdentity(token: string): Promise<{ kyc_url: string | null; status?: string }> {
  return assistRequest(token, '/identity/start', { method: 'POST' }, true);
}

export function completeAssistSession(token: string): Promise<{ status?: AssistedSessionStatusDto } | undefined> {
  return assistRequest(token, '/complete', { method: 'POST' }, true);
}
