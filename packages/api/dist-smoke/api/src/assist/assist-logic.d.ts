import type { AssistedSessionStatus } from '@prisma/client';
import { type OtpState } from '../common/otp';
export declare const ASSIST_STATUS_RANK: Record<AssistedSessionStatus, number>;
export declare const OPEN_ASSIST_STATUSES: readonly AssistedSessionStatus[];
export declare function isAssistSessionOpen(status: AssistedSessionStatus): boolean;
export declare function effectiveAssistStatus(session: {
    status: AssistedSessionStatus;
    expiresAt: Date;
}, now?: Date): AssistedSessionStatus;
export declare function advanceAssistStatus(current: AssistedSessionStatus, next: AssistedSessionStatus): AssistedSessionStatus;
export declare function generateAssistToken(): string;
export declare function generateAssistProof(): string;
export declare function hashAssistProof(proof: string): string;
export declare function assistProofMatches(proof: string | string[] | undefined, proofHash: string | null | undefined): boolean;
export type OtpAttemptResult = {
    outcome: 'verified';
} | {
    outcome: 'invalid';
    remaining: number;
    patch: Pick<OtpState, 'otpAttempts' | 'otpLockedUntil'>;
    lockedForSec: number | null;
} | {
    outcome: 'locked';
    retryAfterSec: number;
} | {
    outcome: 'expired';
} | {
    outcome: 'not_issued';
};
export declare function evaluateOtpAttempt(state: OtpState, matches: boolean, now?: Date): OtpAttemptResult;
export declare function issuedOtpPatch(codeHash: string, now?: Date): {
    otpCodeHash: string;
    otpExpiresAt: Date;
    otpAttempts: number;
};
export declare function verifiedOtpPatch(proofHash: string, now?: Date): {
    otpVerifiedAt: Date;
    otpCodeHash: null;
    otpExpiresAt: null;
    otpAttempts: number;
    otpLockedUntil: null;
    proofHash: string;
};
