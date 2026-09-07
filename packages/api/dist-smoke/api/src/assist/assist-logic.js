"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_ASSIST_STATUSES = exports.ASSIST_STATUS_RANK = void 0;
exports.isAssistSessionOpen = isAssistSessionOpen;
exports.effectiveAssistStatus = effectiveAssistStatus;
exports.advanceAssistStatus = advanceAssistStatus;
exports.generateAssistToken = generateAssistToken;
exports.generateAssistProof = generateAssistProof;
exports.hashAssistProof = hashAssistProof;
exports.assistProofMatches = assistProofMatches;
exports.evaluateOtpAttempt = evaluateOtpAttempt;
exports.issuedOtpPatch = issuedOtpPatch;
exports.verifiedOtpPatch = verifiedOtpPatch;
const node_crypto_1 = require("node:crypto");
const otp_1 = require("../common/otp");
exports.ASSIST_STATUS_RANK = {
    pending: 0,
    otp_verified: 1,
    consents_done: 2,
    identity_started: 3,
    completed: 4,
    expired: -1,
    cancelled: -1,
};
exports.OPEN_ASSIST_STATUSES = [
    'pending',
    'otp_verified',
    'consents_done',
    'identity_started',
];
function isAssistSessionOpen(status) {
    return exports.OPEN_ASSIST_STATUSES.includes(status);
}
function effectiveAssistStatus(session, now = new Date()) {
    if (isAssistSessionOpen(session.status) && session.expiresAt.getTime() <= now.getTime())
        return 'expired';
    return session.status;
}
function advanceAssistStatus(current, next) {
    if (!isAssistSessionOpen(current))
        return current;
    return exports.ASSIST_STATUS_RANK[next] > exports.ASSIST_STATUS_RANK[current] ? next : current;
}
function generateAssistToken() {
    return (0, node_crypto_1.randomBytes)(32).toString('base64url');
}
function generateAssistProof() {
    return (0, node_crypto_1.randomBytes)(32).toString('base64url');
}
function hashAssistProof(proof) {
    return (0, node_crypto_1.createHash)('sha256').update(proof).digest('hex');
}
function assistProofMatches(proof, proofHash) {
    const value = Array.isArray(proof) ? proof[0] : proof;
    if (!value?.trim() || !proofHash)
        return false;
    const actual = Buffer.from(hashAssistProof(value.trim()));
    const expected = Buffer.from(proofHash);
    return actual.length === expected.length && (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
function evaluateOtpAttempt(state, matches, now = new Date()) {
    const gate = (0, otp_1.otpVerifyGate)(state, now);
    if (!gate.ok) {
        if (gate.reason === 'locked') {
            return { outcome: 'locked', retryAfterSec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)) };
        }
        return { outcome: gate.reason };
    }
    if (matches)
        return { outcome: 'verified' };
    const failure = (0, otp_1.otpAfterFailure)(state, now);
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
function issuedOtpPatch(codeHash, now = new Date()) {
    return {
        otpCodeHash: codeHash,
        otpExpiresAt: new Date(now.getTime() + otp_1.OTP_POLICY.ttlMs),
        otpAttempts: 0,
    };
}
function verifiedOtpPatch(proofHash, now = new Date()) {
    return {
        otpVerifiedAt: now,
        otpCodeHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpLockedUntil: null,
        proofHash,
    };
}
//# sourceMappingURL=assist-logic.js.map