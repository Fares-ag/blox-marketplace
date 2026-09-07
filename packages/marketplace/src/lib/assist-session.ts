import type { AssistedSessionPublicDto, AssistedSessionStatusDto } from '@drivemarket/shared';
import {
  PUBLIC_PROOF_HEADER,
  PUBLIC_SESSION_ERROR_CODES,
  PublicSessionError,
  createPublicSessionClient,
} from './public-session';

/**
 * Customer side of an assisted (walk-in) session. Public routes, no cookie
 * session: after the OTP is verified the API hands back a `proof` that must be
 * echoed as `x-assist-proof` on every later call. It lives in sessionStorage so
 * a page refresh on the same device does not force a second OTP.
 *
 * The transport lives in `public-session.ts` and is shared with the guarantor
 * consent flow; the names below are kept for the assist page.
 */
export const ASSIST_PROOF_HEADER = PUBLIC_PROOF_HEADER;
export const AssistApiError = PublicSessionError;
export type AssistApiError = PublicSessionError;
export const ASSIST_ERROR_CODES = PUBLIC_SESSION_ERROR_CODES;

const client = createPublicSessionClient('/api/assist', 'blox-assist-proof:');

export const readAssistProof = client.proof.read;
export const storeAssistProof = client.proof.store;
export const clearAssistProof = client.proof.clear;

export function fetchAssistSession(token: string): Promise<AssistedSessionPublicDto> {
  return client.request<AssistedSessionPublicDto>(token, '', { method: 'GET' });
}

export function verifyAssistOtp(
  token: string,
  code: string,
): Promise<{ proof: string; status: AssistedSessionStatusDto }> {
  return client.request(token, '/otp/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export function resendAssistOtp(
  token: string,
): Promise<{ status?: string; otp_expires_in_sec?: number; retry_after_sec?: number } | undefined> {
  return client.request(token, '/otp/resend', { method: 'POST' });
}

export function submitAssistConsents(
  token: string,
  acceptances: Array<{ code: string; version: string }>,
  locale: 'en' | 'ar',
): Promise<{ status?: AssistedSessionStatusDto } | undefined> {
  return client.request(token, '/consents', { method: 'POST', body: JSON.stringify({ acceptances, locale }) }, true);
}

export function startAssistIdentity(token: string): Promise<{ kyc_url: string | null; status?: string }> {
  return client.request(token, '/identity/start', { method: 'POST' }, true);
}

export function completeAssistSession(token: string): Promise<{ status?: AssistedSessionStatusDto } | undefined> {
  return client.request(token, '/complete', { method: 'POST' }, true);
}
