import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Email OTP for the mobile forgot-password path. Shorter than the web reset link. */
export const PASSWORD_RESET_OTP_TTL_MS = 15 * 60_000;
export const PASSWORD_RESET_OTP_LENGTH = 6;
export const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_OTP_IDENTIFIER_PREFIX = 'password-reset-otp:';

export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If this email exists in our system, check your email for the reset link';
export const PASSWORD_RESET_OTP_REQUEST_MESSAGE =
  'If this email exists in our system, check your email for the verification code';

export type PasswordResetOtpRecord = {
  hash: string;
  attempts: number;
};

export function passwordResetOtpIdentifier(email: string): string {
  return `${PASSWORD_RESET_OTP_IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

export function generatePasswordResetOtp(): string {
  return String(randomInt(0, 10 ** PASSWORD_RESET_OTP_LENGTH)).padStart(PASSWORD_RESET_OTP_LENGTH, '0');
}

export function hashPasswordResetOtp(secret: string, email: string, code: string): string {
  return createHmac('sha256', secret).update(`${passwordResetOtpIdentifier(email)}:${code}`).digest('hex');
}

export function passwordResetOtpMatches(secret: string, email: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPasswordResetOtp(secret, email, code));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encodePasswordResetOtpRecord(record: PasswordResetOtpRecord): string {
  return JSON.stringify({ hash: record.hash, attempts: record.attempts });
}

export function decodePasswordResetOtpRecord(value: string): PasswordResetOtpRecord | null {
  try {
    const parsed = JSON.parse(value) as { hash?: unknown; attempts?: unknown };
    if (typeof parsed.hash !== 'string' || !parsed.hash) return null;
    const attempts = typeof parsed.attempts === 'number' && Number.isFinite(parsed.attempts) ? parsed.attempts : 0;
    return { hash: parsed.hash, attempts: Math.max(0, Math.trunc(attempts)) };
  } catch {
    return null;
  }
}

/** `OTP` is the contract field; `otp` is accepted so a lowercase client still works. */
export function readPasswordResetOtp(body: Record<string, unknown> | null | undefined): string {
  const raw = body?.OTP ?? body?.otp;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function isMobilePasswordReset(body: Record<string, unknown> | null | undefined): boolean {
  return body?.isMobile === true;
}
