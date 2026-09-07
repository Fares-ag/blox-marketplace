"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_PLACEHOLDER_SECRETS = exports.INSECURE_AUTH_SECRET = void 0;
exports.resolveAuthSecret = resolveAuthSecret;
exports.resolveAuthBaseUrl = resolveAuthBaseUrl;
exports.resolveApiPort = resolveApiPort;
exports.resolveRequireEmailVerification = resolveRequireEmailVerification;
exports.resolveCookieDomain = resolveCookieDomain;
exports.resolveSessionCookieCacheMaxAge = resolveSessionCookieCacheMaxAge;
exports.resolvePrivilegedLoginLockout = resolvePrivilegedLoginLockout;
exports.resolveMfaEnforcement = resolveMfaEnforcement;
exports.isMfaEnforcementActive = isMfaEnforcementActive;
const login_lockout_1 = require("./login-lockout");
exports.INSECURE_AUTH_SECRET = 'dev-secret-change-me';
exports.KNOWN_PLACEHOLDER_SECRETS = [
    exports.INSECURE_AUTH_SECRET,
    'dev-change-me-to-a-long-random-string-32chars',
];
const PLACEHOLDER_PATTERN = /change[-_]?me|placeholder|example|secret[-_]?here|^dev[-_]/i;
function resolveAuthSecret(config) {
    const secret = config.get('BETTER_AUTH_SECRET')?.trim();
    if (!secret) {
        throw new Error('BETTER_AUTH_SECRET is required. Generate one with: openssl rand -base64 48');
    }
    if (exports.KNOWN_PLACEHOLDER_SECRETS.includes(secret)) {
        throw new Error('BETTER_AUTH_SECRET matches a known placeholder shipped in .env.example. ' +
            'Generate a unique secret (openssl rand -base64 48) and set it via your secret manager.');
    }
    if (PLACEHOLDER_PATTERN.test(secret)) {
        throw new Error('BETTER_AUTH_SECRET looks like a placeholder (contains "change-me"/"dev-"/"example"). ' +
            'Generate a unique secret (openssl rand -base64 48).');
    }
    if (secret.length < 32) {
        throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
    }
    const distinct = new Set(secret).size;
    if (distinct < 10) {
        throw new Error('BETTER_AUTH_SECRET has too little entropy (repeated characters).');
    }
    return secret;
}
function resolveAuthBaseUrl(config) {
    return config.get('BETTER_AUTH_URL') ?? 'http://localhost:3010';
}
function resolveApiPort(config) {
    const port = process.env.PORT ?? config.get('API_PORT') ?? 3010;
    return Number(port);
}
function resolveRequireEmailVerification(config) {
    const raw = config.get('REQUIRE_EMAIL_VERIFICATION')?.trim().toLowerCase();
    if (raw === 'true' || raw === '1')
        return true;
    if (raw === 'false' || raw === '0')
        return false;
    return process.env.NODE_ENV === 'production';
}
function resolveCookieDomain(config) {
    const domain = config.get('COOKIE_DOMAIN')?.trim();
    return domain || undefined;
}
function resolveSessionCookieCacheMaxAge(config) {
    const raw = config.get('SESSION_COOKIE_CACHE_MAX_AGE_SEC')?.trim();
    if (!raw)
        return 60;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('SESSION_COOKIE_CACHE_MAX_AGE_SEC must be a non-negative number.');
    }
    return Math.floor(parsed);
}
function resolvePrivilegedLoginLockout(config) {
    const maxRaw = config.get('PRIVILEGED_LOGIN_MAX_ATTEMPTS')?.trim();
    const durationRaw = config.get('PRIVILEGED_LOGIN_LOCKOUT_SEC')?.trim();
    const maxFailedAttempts = maxRaw ? Number(maxRaw) : login_lockout_1.DEFAULT_LOGIN_LOCKOUT.maxFailedAttempts;
    const lockoutDurationSeconds = durationRaw
        ? Number(durationRaw)
        : login_lockout_1.DEFAULT_LOGIN_LOCKOUT.lockoutDurationSeconds;
    if (!Number.isFinite(maxFailedAttempts) || maxFailedAttempts < 1) {
        throw new Error('PRIVILEGED_LOGIN_MAX_ATTEMPTS must be a positive number.');
    }
    if (!Number.isFinite(lockoutDurationSeconds) || lockoutDurationSeconds < 60) {
        throw new Error('PRIVILEGED_LOGIN_LOCKOUT_SEC must be at least 60.');
    }
    return {
        maxFailedAttempts: Math.floor(maxFailedAttempts),
        lockoutDurationSeconds: Math.floor(lockoutDurationSeconds),
    };
}
function resolveMfaEnforcement(config) {
    const raw = config.get('MFA_ENFORCE')?.trim().toLowerCase();
    let enforced;
    if (raw === 'true' || raw === '1')
        enforced = true;
    else if (raw === 'false' || raw === '0')
        enforced = false;
    else
        enforced = false;
    const graceRaw = config.get('MFA_GRACE_UNTIL')?.trim();
    if (!graceRaw)
        return { enforced, graceUntil: null };
    const graceUntil = new Date(graceRaw);
    if (Number.isNaN(graceUntil.getTime())) {
        throw new Error('MFA_GRACE_UNTIL must be a valid ISO date.');
    }
    return { enforced, graceUntil };
}
function isMfaEnforcementActive(config, now = new Date()) {
    if (!config.enforced)
        return false;
    if (config.graceUntil && now < config.graceUntil)
        return false;
    return true;
}
//# sourceMappingURL=auth-config.js.map