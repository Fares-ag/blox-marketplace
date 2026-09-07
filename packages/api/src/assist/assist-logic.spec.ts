import { describe, expect, it } from 'vitest';
import { OTP_POLICY, type OtpState } from '../common/otp';
import {
  advanceAssistStatus,
  assistProofMatches,
  effectiveAssistStatus,
  evaluateOtpAttempt,
  generateAssistProof,
  generateAssistToken,
  hashAssistProof,
  isAssistSessionOpen,
  issuedOtpPatch,
  verifiedOtpPatch,
} from './assist-logic';

const NOW = new Date('2026-09-07T10:00:00Z');

function issued(overrides: Partial<OtpState> = {}): OtpState {
  return {
    otpExpiresAt: new Date(NOW.getTime() + OTP_POLICY.ttlMs),
    otpAttempts: 0,
    otpLockedUntil: null,
    otpResendCount: 0,
    otpResendWindowStart: null,
    ...overrides,
  };
}

describe('effectiveAssistStatus', () => {
  it('reads an open session past its expiry as expired', () => {
    const past = new Date(NOW.getTime() - 1000);
    const future = new Date(NOW.getTime() + 60_000);
    expect(effectiveAssistStatus({ status: 'pending', expiresAt: future }, NOW)).toBe('pending');
    expect(effectiveAssistStatus({ status: 'pending', expiresAt: past }, NOW)).toBe('expired');
    expect(effectiveAssistStatus({ status: 'identity_started', expiresAt: past }, NOW)).toBe('expired');
  });

  it('never touches terminal sessions', () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(effectiveAssistStatus({ status: 'completed', expiresAt: past }, NOW)).toBe('completed');
    expect(effectiveAssistStatus({ status: 'cancelled', expiresAt: past }, NOW)).toBe('cancelled');
    expect(isAssistSessionOpen('completed')).toBe(false);
    expect(isAssistSessionOpen('otp_verified')).toBe(true);
  });
});

describe('advanceAssistStatus', () => {
  it('moves forward through the customer steps', () => {
    expect(advanceAssistStatus('pending', 'otp_verified')).toBe('otp_verified');
    expect(advanceAssistStatus('otp_verified', 'consents_done')).toBe('consents_done');
    expect(advanceAssistStatus('consents_done', 'identity_started')).toBe('identity_started');
    expect(advanceAssistStatus('identity_started', 'completed')).toBe('completed');
  });

  it('never regresses (re-verifying the OTP after consents keeps consents_done)', () => {
    expect(advanceAssistStatus('consents_done', 'otp_verified')).toBe('consents_done');
    expect(advanceAssistStatus('identity_started', 'consents_done')).toBe('identity_started');
  });

  it('leaves terminal sessions alone', () => {
    expect(advanceAssistStatus('cancelled', 'otp_verified')).toBe('cancelled');
    expect(advanceAssistStatus('expired', 'completed')).toBe('expired');
    expect(advanceAssistStatus('completed', 'identity_started')).toBe('completed');
  });
});

describe('evaluateOtpAttempt (OTP state machine)', () => {
  it('refuses when no code was issued', () => {
    expect(evaluateOtpAttempt(issued({ otpExpiresAt: null }), true, NOW)).toEqual({ outcome: 'not_issued' });
  });

  it('refuses an expired code even when it matches', () => {
    const state = issued({ otpExpiresAt: new Date(NOW.getTime() - 1) });
    expect(evaluateOtpAttempt(state, true, NOW)).toEqual({ outcome: 'expired' });
  });

  it('refuses while locked and reports the wait in whole seconds', () => {
    const state = issued({ otpLockedUntil: new Date(NOW.getTime() + 61_500) });
    expect(evaluateOtpAttempt(state, true, NOW)).toEqual({ outcome: 'locked', retryAfterSec: 62 });
  });

  it('counts a wrong code and reports the remaining attempts', () => {
    const result = evaluateOtpAttempt(issued(), false, NOW);
    expect(result.outcome).toBe('invalid');
    if (result.outcome !== 'invalid') return;
    expect(result.remaining).toBe(OTP_POLICY.maxAttempts - 1);
    expect(result.patch).toEqual({ otpAttempts: 1, otpLockedUntil: null });
    expect(result.lockedForSec).toBeNull();
  });

  it('locks on the last allowed failure', () => {
    const result = evaluateOtpAttempt(issued({ otpAttempts: OTP_POLICY.maxAttempts - 1 }), false, NOW);
    expect(result.outcome).toBe('invalid');
    if (result.outcome !== 'invalid') return;
    expect(result.remaining).toBe(0);
    expect(result.patch.otpAttempts).toBe(OTP_POLICY.maxAttempts);
    expect(result.patch.otpLockedUntil?.getTime()).toBe(NOW.getTime() + OTP_POLICY.lockMs);
    expect(result.lockedForSec).toBe(OTP_POLICY.lockMs / 1000);
  });

  it('verifies a matching code once the lock has elapsed', () => {
    const state = issued({ otpAttempts: 5, otpLockedUntil: new Date(NOW.getTime() - 1) });
    expect(evaluateOtpAttempt(state, true, NOW)).toEqual({ outcome: 'verified' });
  });

  it('walks a full pending → locked → verified sequence', () => {
    let state = issued();
    for (let i = 0; i < OTP_POLICY.maxAttempts; i += 1) {
      const result = evaluateOtpAttempt(state, false, NOW);
      expect(result.outcome).toBe('invalid');
      if (result.outcome === 'invalid') state = { ...state, ...result.patch };
    }
    expect(evaluateOtpAttempt(state, true, NOW).outcome).toBe('locked');
    const later = new Date(NOW.getTime() + OTP_POLICY.lockMs + 1);
    // A fresh code was issued after the lock (resend): attempts reset, expiry renewed.
    state = { ...state, ...issuedOtpPatch('hash', later) };
    expect(evaluateOtpAttempt(state, true, later)).toEqual({ outcome: 'verified' });
  });
});

describe('OTP patches', () => {
  it('issues a code with the policy TTL and zero attempts', () => {
    expect(issuedOtpPatch('hash', NOW)).toEqual({
      otpCodeHash: 'hash',
      otpExpiresAt: new Date(NOW.getTime() + OTP_POLICY.ttlMs),
      otpAttempts: 0,
    });
  });

  it('retires the code and stores the proof hash on verification', () => {
    expect(verifiedOtpPatch('proof-hash', NOW)).toEqual({
      otpVerifiedAt: NOW,
      otpCodeHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
      proofHash: 'proof-hash',
    });
  });
});

describe('proof and token helpers', () => {
  it('matches a proof only against its own hash', () => {
    const proof = generateAssistProof();
    const hash = hashAssistProof(proof);
    expect(assistProofMatches(proof, hash)).toBe(true);
    expect(assistProofMatches([proof], hash)).toBe(true);
    expect(assistProofMatches(`${proof}x`, hash)).toBe(false);
    expect(assistProofMatches(undefined, hash)).toBe(false);
    expect(assistProofMatches(proof, null)).toBe(false);
    expect(assistProofMatches('', hash)).toBe(false);
  });

  it('generates url-safe, unique 256-bit tokens', () => {
    const a = generateAssistToken();
    const b = generateAssistToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
