import { apiUrl } from '@drivemarket/shared';
import { readErrorBody } from './multipart';

/**
 * Shared plumbing for the two public, cookie-less flows a customer opens from
 * an SMS link: the assisted (walk-in) session under `/api/assist/:token` and
 * the guarantor consent session under `/api/guarantor/:token`.
 *
 * Both hand back a `proof` after the OTP is verified that must be echoed as
 * `x-assist-proof` on every later call. The proof lives in sessionStorage so a
 * refresh on the same device does not force a second OTP.
 */

export const PUBLIC_PROOF_HEADER = 'x-assist-proof';

export class PublicSessionError extends Error {
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
    this.name = 'PublicSessionError';
  }
}

/** Machine codes the public assist/guarantor routes emit (same OTP semantics on both). */
export const PUBLIC_SESSION_ERROR_CODES = {
  otpInvalid: 'otp_invalid',
  otpLocked: 'otp_locked',
  otpExpired: 'otp_expired',
  proofMissing: 'assist_proof_missing',
  proofInvalid: 'assist_proof_invalid',
  sessionExpired: 'assist_session_expired',
  sessionClosed: 'assist_session_closed',
  consentsRequired: 'consents_required',
} as const;

/** The guarantor routes may prefix their own codes (`guarantor_session_expired`); match on the suffix. */
export function isSessionExpiredCode(code: string): boolean {
  return code.endsWith('session_expired');
}

export function isSessionClosedCode(code: string): boolean {
  return code.endsWith('session_closed') || code.endsWith('session_cancelled');
}

export function isProofRejectedCode(code: string): boolean {
  return code.endsWith('proof_missing') || code.endsWith('proof_invalid') || code.endsWith('proof_required');
}

export function proofRejected(error: unknown): boolean {
  return (
    error instanceof PublicSessionError &&
    (isProofRejectedCode(error.code) || error.status === 401 || error.status === 403)
  );
}

export type ProofStore = {
  read: (token: string) => string | null;
  store: (token: string, proof: string) => void;
  clear: (token: string) => void;
};

export function createProofStore(prefix: string): ProofStore {
  return {
    read(token) {
      try {
        return sessionStorage.getItem(prefix + token);
      } catch {
        return null;
      }
    },
    store(token, proof) {
      try {
        sessionStorage.setItem(prefix + token, proof);
      } catch {
        /* private mode / storage blocked: the proof only lives in memory for this page */
      }
    },
    clear(token) {
      try {
        sessionStorage.removeItem(prefix + token);
      } catch {
        /* ignore */
      }
    },
  };
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export type PublicSessionClient = {
  request: <T>(token: string, path: string, init?: RequestInit, withProof?: boolean) => Promise<T>;
  proof: ProofStore;
};

/**
 * Builds a request function bound to a public base path (`/api/assist`,
 * `/api/guarantor`). `withProof` reads the stored proof for the token and
 * fails fast with `assist_proof_missing` when there is none.
 */
export function createPublicSessionClient(basePath: string, proofPrefix: string): PublicSessionClient {
  const proof = createProofStore(proofPrefix);

  async function request<T>(token: string, path: string, init: RequestInit = {}, withProof = false): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (withProof) {
      const stored = proof.read(token);
      if (!stored) {
        throw new PublicSessionError(PUBLIC_SESSION_ERROR_CODES.proofMissing, 0, PUBLIC_SESSION_ERROR_CODES.proofMissing);
      }
      headers.set(PUBLIC_PROOF_HEADER, stored);
    }
    const res = await fetch(apiUrl(`${basePath}/${encodeURIComponent(token)}${path}`), {
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
      throw new PublicSessionError(
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

  return { request, proof };
}
