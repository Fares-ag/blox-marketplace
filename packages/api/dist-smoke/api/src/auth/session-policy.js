"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSessionPolicy = resolveSessionPolicy;
exports.sessionPolicyDto = sessionPolicyDto;
exports.sessionPastAbsoluteLimit = sessionPastAbsoluteLimit;
function intEnv(config, key, fallback, min) {
    const raw = config.get(key);
    const n = raw == null || raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(n) || n < min)
        return fallback;
    return Math.floor(n);
}
function resolveSessionPolicy(config) {
    const idleTimeoutSec = intEnv(config, 'SESSION_IDLE_TIMEOUT_SEC', 600, 60);
    const absoluteTimeoutSec = Math.max(idleTimeoutSec, intEnv(config, 'SESSION_ABSOLUTE_TIMEOUT_SEC', 8 * 3600, 300));
    const warningSec = Math.min(idleTimeoutSec - 10, intEnv(config, 'SESSION_IDLE_WARNING_SEC', 60, 10));
    const singleRaw = (config.get('SESSION_SINGLE_PER_USER') ?? 'true').trim().toLowerCase();
    return {
        idleTimeoutSec,
        absoluteTimeoutSec,
        warningSec,
        singleSession: singleRaw !== 'false' && singleRaw !== '0',
    };
}
function sessionPolicyDto(policy) {
    return {
        idle_timeout_sec: policy.idleTimeoutSec,
        absolute_timeout_sec: policy.absoluteTimeoutSec,
        warning_sec: policy.warningSec,
        single_session: policy.singleSession,
    };
}
function sessionPastAbsoluteLimit(createdAt, policy, now = new Date()) {
    if (!createdAt)
        return false;
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(created.getTime()))
        return false;
    return now.getTime() - created.getTime() > policy.absoluteTimeoutSec * 1000;
}
//# sourceMappingURL=session-policy.js.map