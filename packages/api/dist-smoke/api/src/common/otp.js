"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTP_POLICY = void 0;
exports.generateOtp = generateOtp;
exports.hashOtp = hashOtp;
exports.otpMatches = otpMatches;
exports.otpVerifyGate = otpVerifyGate;
exports.otpAfterFailure = otpAfterFailure;
exports.otpResendGate = otpResendGate;
const node_crypto_1 = require("node:crypto");
exports.OTP_POLICY = {
    length: 6,
    ttlMs: 5 * 60_000,
    maxAttempts: 5,
    lockMs: 15 * 60_000,
    maxResends: 3,
    resendWindowMs: 15 * 60_000,
};
function generateOtp() {
    return String((0, node_crypto_1.randomInt)(0, 10 ** exports.OTP_POLICY.length)).padStart(exports.OTP_POLICY.length, '0');
}
function hashOtp(secret, sessionId, code) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(`${sessionId}:${code}`).digest('hex');
}
function otpMatches(secret, sessionId, code, expectedHash) {
    const actual = Buffer.from(hashOtp(secret, sessionId, code));
    const expected = Buffer.from(expectedHash);
    return actual.length === expected.length && (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
function otpVerifyGate(state, now = new Date()) {
    if (state.otpLockedUntil && state.otpLockedUntil.getTime() > now.getTime()) {
        return { ok: false, reason: 'locked', retryAfterMs: state.otpLockedUntil.getTime() - now.getTime() };
    }
    if (!state.otpExpiresAt)
        return { ok: false, reason: 'not_issued' };
    if (state.otpExpiresAt.getTime() <= now.getTime())
        return { ok: false, reason: 'expired' };
    return { ok: true };
}
function otpAfterFailure(state, now = new Date()) {
    const attempts = state.otpAttempts + 1;
    if (attempts >= exports.OTP_POLICY.maxAttempts) {
        return { otpAttempts: attempts, otpLockedUntil: new Date(now.getTime() + exports.OTP_POLICY.lockMs), remaining: 0 };
    }
    return { otpAttempts: attempts, remaining: exports.OTP_POLICY.maxAttempts - attempts };
}
function otpResendGate(state, now = new Date()) {
    const windowStart = state.otpResendWindowStart;
    const inWindow = windowStart && now.getTime() - windowStart.getTime() < exports.OTP_POLICY.resendWindowMs;
    if (!inWindow) {
        return { ok: true, next: { otpResendCount: 1, otpResendWindowStart: now } };
    }
    if (state.otpResendCount >= exports.OTP_POLICY.maxResends) {
        return { ok: false, retryAfterMs: windowStart.getTime() + exports.OTP_POLICY.resendWindowMs - now.getTime() };
    }
    return { ok: true, next: { otpResendCount: state.otpResendCount + 1, otpResendWindowStart: windowStart } };
}
//# sourceMappingURL=otp.js.map