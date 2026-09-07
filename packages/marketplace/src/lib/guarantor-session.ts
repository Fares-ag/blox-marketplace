import type { GuarantorSessionPublicDto, GuarantorSessionStatusDto } from '@drivemarket/shared';
import { createPublicSessionClient } from './public-session';

/**
 * Guarantor side of a consent session (`/guarantor/:token`, no auth). Mirrors
 * the assisted-session client: OTP → proof → consents → optional identity →
 * complete. Never returns the OTP; the phone stays masked server-side.
 */
const client = createPublicSessionClient('/api/guarantor', 'blox-guarantor-proof:');

export const readGuarantorProof = client.proof.read;
export const storeGuarantorProof = client.proof.store;
export const clearGuarantorProof = client.proof.clear;

export function fetchGuarantorSession(token: string): Promise<GuarantorSessionPublicDto> {
  return client.request<GuarantorSessionPublicDto>(token, '', { method: 'GET' });
}

export function verifyGuarantorOtp(
  token: string,
  code: string,
): Promise<{ proof: string; status: GuarantorSessionStatusDto }> {
  return client.request(token, '/otp/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export function resendGuarantorOtp(
  token: string,
): Promise<{ status?: string; otp_expires_in_sec?: number; retry_after_sec?: number } | undefined> {
  return client.request(token, '/otp/resend', { method: 'POST' });
}

export function submitGuarantorConsents(
  token: string,
  acceptances: Array<{ code: string; version: string }>,
  locale: 'en' | 'ar',
): Promise<{ status?: GuarantorSessionStatusDto } | undefined> {
  return client.request(token, '/consents', { method: 'POST', body: JSON.stringify({ acceptances, locale }) }, true);
}

export function startGuarantorIdentity(token: string): Promise<{ kyc_url: string | null; status?: string }> {
  return client.request(token, '/identity/start', { method: 'POST' }, true);
}

export function completeGuarantorSession(
  token: string,
): Promise<{ status?: GuarantorSessionStatusDto } | undefined> {
  return client.request(token, '/complete', { method: 'POST' }, true);
}
