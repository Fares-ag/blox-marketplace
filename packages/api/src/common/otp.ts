import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** One-time-code policy for assisted sessions (LOS FSD Stage 1 OTP controls). */
export const OTP_POLICY = {
  length: 6,
  ttlMs: 5 * 60_000,
  maxAttempts: 5,
  lockMs: 15 * 60_000,
  maxResends: 3,
  resendWindowMs: 15 * 60_000,
} as const;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_POLICY.length)).padStart(OTP_POLICY.length, '0');
}

export function hashOtp(secret: string, sessionId: string, code: string): string {
  return createHmac('sha256', secret).update(`${sessionId}:${code}`).digest('hex');
}

export function otpMatches(secret: string, sessionId: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(secret, sessionId, code));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type OtpState = {
  otpExpiresAt: Date | null;
  otpAttempts: number;
  otpLockedUntil: Date | null;
  otpResendCount: number;
  otpResendWindowStart: Date | null;
};

export type OtpGate =
  | { ok: true }
  | { ok: false; reason: 'locked'; retryAfterMs: number }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'not_issued' };

/** Can a code be checked right now? */
export function otpVerifyGate(state: OtpState, now = new Date()): OtpGate {
  if (state.otpLockedUntil && state.otpLockedUntil.getTime() > now.getTime()) {
    return { ok: false, reason: 'locked', retryAfterMs: state.otpLockedUntil.getTime() - now.getTime() };
  }
  if (!state.otpExpiresAt) return { ok: false, reason: 'not_issued' };
  if (state.otpExpiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

/** State transition after a wrong code: bumps attempts, locks on the last one. */
export function otpAfterFailure(state: OtpState, now = new Date()): Partial<OtpState> & { remaining: number } {
  const attempts = state.otpAttempts + 1;
  if (attempts >= OTP_POLICY.maxAttempts) {
    return { otpAttempts: attempts, otpLockedUntil: new Date(now.getTime() + OTP_POLICY.lockMs), remaining: 0 };
  }
  return { otpAttempts: attempts, remaining: OTP_POLICY.maxAttempts - attempts };
}

export type ResendGate =
  | { ok: true; next: Pick<OtpState, 'otpResendCount' | 'otpResendWindowStart'> }
  | { ok: false; retryAfterMs: number };

/** Resend budget: N sends per rolling window. */
export function otpResendGate(state: OtpState, now = new Date()): ResendGate {
  const windowStart = state.otpResendWindowStart;
  const inWindow = windowStart && now.getTime() - windowStart.getTime() < OTP_POLICY.resendWindowMs;
  if (!inWindow) {
    return { ok: true, next: { otpResendCount: 1, otpResendWindowStart: now } };
  }
  if (state.otpResendCount >= OTP_POLICY.maxResends) {
    return { ok: false, retryAfterMs: windowStart!.getTime() + OTP_POLICY.resendWindowMs - now.getTime() };
  }
  return { ok: true, next: { otpResendCount: state.otpResendCount + 1, otpResendWindowStart: windowStart! } };
}
