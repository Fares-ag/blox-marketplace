import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AssistedSessionStatus } from '@prisma/client';
import { OTP_POLICY, otpAfterFailure, otpVerifyGate, type OtpState } from '../common/otp';

/** Forward-only ordering of the customer steps; terminal states rank below everything. */
export const ASSIST_STATUS_RANK: Record<AssistedSessionStatus, number> = {
  pending: 0,
  otp_verified: 1,
  consents_done: 2,
  identity_started: 3,
  completed: 4,
  expired: -1,
  cancelled: -1,
};

export const OPEN_ASSIST_STATUSES: readonly AssistedSessionStatus[] = [
  'pending',
  'otp_verified',
  'consents_done',
  'identity_started',
];

export function isAssistSessionOpen(status: AssistedSessionStatus): boolean {
  return OPEN_ASSIST_STATUSES.includes(status);
}

/** An open session past its expiry reads as `expired`; the service persists that lazily. */
export function effectiveAssistStatus(
  session: { status: AssistedSessionStatus; expiresAt: Date },
  now: Date = new Date(),
): AssistedSessionStatus {
  if (isAssistSessionOpen(session.status) && session.expiresAt.getTime() <= now.getTime()) return 'expired';
  return session.status;
}

/** Steps only move forward: re-verifying the OTP after consents never drops the session back. */
export function advanceAssistStatus(
  current: AssistedSessionStatus,
  next: AssistedSessionStatus,
): AssistedSessionStatus {
  if (!isAssistSessionOpen(current)) return current;
  return ASSIST_STATUS_RANK[next] > ASSIST_STATUS_RANK[current] ? next : current;
}

export function generateAssistToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateAssistProof(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAssistProof(proof: string): string {
  return createHash('sha256').update(proof).digest('hex');
}

/** Constant-time check of the `x-assist-proof` header against the stored hash. */
export function assistProofMatches(
  proof: string | string[] | undefined,
  proofHash: string | null | undefined,
): boolean {
  const value = Array.isArray(proof) ? proof[0] : proof;
  if (!value?.trim() || !proofHash) return false;
  const actual = Buffer.from(hashAssistProof(value.trim()));
  const expected = Buffer.from(proofHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type OtpAttemptResult =
  | { outcome: 'verified' }
  | {
      outcome: 'invalid';
      remaining: number;
      patch: Pick<OtpState, 'otpAttempts' | 'otpLockedUntil'>;
      /** Set when this failure was the last allowed one and the session is now locked. */
      lockedForSec: number | null;
    }
  | { outcome: 'locked'; retryAfterSec: number }
  | { outcome: 'expired' }
  | { outcome: 'not_issued' };

/** One verification attempt through the OTP state machine (pure; the caller persists `patch`). */
export function evaluateOtpAttempt(state: OtpState, matches: boolean, now: Date = new Date()): OtpAttemptResult {
  const gate = otpVerifyGate(state, now);
  if (!gate.ok) {
    if (gate.reason === 'locked') {
      return { outcome: 'locked', retryAfterSec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)) };
    }
    return { outcome: gate.reason };
  }
  if (matches) return { outcome: 'verified' };

  const failure = otpAfterFailure(state, now);
  const lockedUntil = failure.otpLockedUntil ?? null;
  return {
    outcome: 'invalid',
    remaining: failure.remaining,
    patch: {
      otpAttempts: failure.otpAttempts ?? state.otpAttempts + 1,
      otpLockedUntil: lockedUntil ?? state.otpLockedUntil,
    },
    lockedForSec: lockedUntil ? Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)) : null,
  };
}

/** Fields to persist when a fresh code is issued (create or resend). */
export function issuedOtpPatch(codeHash: string, now: Date = new Date()) {
  return {
    otpCodeHash: codeHash,
    otpExpiresAt: new Date(now.getTime() + OTP_POLICY.ttlMs),
    otpAttempts: 0,
  };
}

/** Fields to persist after a successful verification: the code is single-use and a proof replaces it. */
export function verifiedOtpPatch(proofHash: string, now: Date = new Date()) {
  return {
    otpVerifiedAt: now,
    otpCodeHash: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    otpLockedUntil: null,
    proofHash,
  };
}
