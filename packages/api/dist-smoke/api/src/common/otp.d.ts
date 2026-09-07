export declare const OTP_POLICY: {
    readonly length: 6;
    readonly ttlMs: number;
    readonly maxAttempts: 5;
    readonly lockMs: number;
    readonly maxResends: 3;
    readonly resendWindowMs: number;
};
export declare function generateOtp(): string;
export declare function hashOtp(secret: string, sessionId: string, code: string): string;
export declare function otpMatches(secret: string, sessionId: string, code: string, expectedHash: string): boolean;
export type OtpState = {
    otpExpiresAt: Date | null;
    otpAttempts: number;
    otpLockedUntil: Date | null;
    otpResendCount: number;
    otpResendWindowStart: Date | null;
};
export type OtpGate = {
    ok: true;
} | {
    ok: false;
    reason: 'locked';
    retryAfterMs: number;
} | {
    ok: false;
    reason: 'expired';
} | {
    ok: false;
    reason: 'not_issued';
};
export declare function otpVerifyGate(state: OtpState, now?: Date): OtpGate;
export declare function otpAfterFailure(state: OtpState, now?: Date): Partial<OtpState> & {
    remaining: number;
};
export type ResendGate = {
    ok: true;
    next: Pick<OtpState, 'otpResendCount' | 'otpResendWindowStart'>;
} | {
    ok: false;
    retryAfterMs: number;
};
export declare function otpResendGate(state: OtpState, now?: Date): ResendGate;
