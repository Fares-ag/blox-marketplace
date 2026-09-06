import { describe, expect, it } from 'vitest';
import { OTP_POLICY, generateOtp, hashOtp, otpAfterFailure, otpMatches, otpResendGate, otpVerifyGate } from './otp';

const NOW = new Date('2026-09-07T10:00:00Z');
const fresh = () => ({
  otpExpiresAt: new Date(NOW.getTime() + OTP_POLICY.ttlMs),
  otpAttempts: 0,
  otpLockedUntil: null,
  otpResendCount: 0,
  otpResendWindowStart: null,
});

describe('otp policy', () => {
  it('generates 6-digit codes and verifies them in constant time', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    const hash = hashOtp('secret', 'sess', code);
    expect(otpMatches('secret', 'sess', code, hash)).toBe(true);
    expect(otpMatches('secret', 'sess', code === '000000' ? '111111' : '000000', hash)).toBe(false);
    expect(otpMatches('secret', 'other-session', code, hash)).toBe(false);
  });

  it('gates verification on expiry and lock', () => {
    expect(otpVerifyGate(fresh(), NOW)).toEqual({ ok: true });
    expect(otpVerifyGate({ ...fresh(), otpExpiresAt: new Date(NOW.getTime() - 1) }, NOW)).toEqual({ ok: false, reason: 'expired' });
    const locked = otpVerifyGate({ ...fresh(), otpLockedUntil: new Date(NOW.getTime() + 60_000) }, NOW);
    expect(locked.ok).toBe(false);
    expect((locked as { retryAfterMs: number }).retryAfterMs).toBe(60_000);
  });

  it('locks after the fifth wrong attempt', () => {
    let state = fresh();
    let result = otpAfterFailure(state, NOW);
    expect(result.remaining).toBe(4);
    state = { ...state, otpAttempts: 4 };
    result = otpAfterFailure(state, NOW);
    expect(result.remaining).toBe(0);
    expect(result.otpLockedUntil?.getTime()).toBe(NOW.getTime() + OTP_POLICY.lockMs);
  });

  it('limits resends per window', () => {
    const first = otpResendGate(fresh(), NOW);
    expect(first.ok).toBe(true);
    const exhausted = otpResendGate({ ...fresh(), otpResendCount: 3, otpResendWindowStart: NOW }, new Date(NOW.getTime() + 60_000));
    expect(exhausted.ok).toBe(false);
    const newWindow = otpResendGate(
      { ...fresh(), otpResendCount: 3, otpResendWindowStart: NOW },
      new Date(NOW.getTime() + OTP_POLICY.resendWindowMs + 1),
    );
    expect(newWindow.ok).toBe(true);
  });
});
