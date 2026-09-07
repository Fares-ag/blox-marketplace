"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMobileAccessToken = signMobileAccessToken;
exports.verifyMobileAccessToken = verifyMobileAccessToken;
exports.newRefreshToken = newRefreshToken;
exports.hashRefreshToken = hashRefreshToken;
exports.bearerFromHeader = bearerFromHeader;
const node_crypto_1 = require("node:crypto");
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function b64url(input) {
    const buf = typeof input === 'string' ? Buffer.from(input) : input;
    return buf.toString('base64url');
}
function signMobileAccessToken(secret, claims, ttlSeconds = ACCESS_TTL_SECONDS) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttlSeconds;
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify({ ...claims, iat, exp }));
    const sig = b64url((0, node_crypto_1.createHmac)('sha256', secret).update(`${header}.${body}`).digest());
    return {
        token: `${header}.${body}.${sig}`,
        expiresAt: new Date(exp * 1000),
    };
}
function verifyMobileAccessToken(secret, token) {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [header, body, sig] = parts;
    const expected = b64url((0, node_crypto_1.createHmac)('sha256', secret).update(`${header}.${body}`).digest());
    try {
        if (expected.length !== sig.length)
            return null;
        if (!(0, node_crypto_1.timingSafeEqual)(Buffer.from(expected), Buffer.from(sig)))
            return null;
    }
    catch {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (!payload.sub || !payload.exp)
            return null;
        if (payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
function newRefreshToken() {
    const raw = (0, node_crypto_1.randomBytes)(32).toString('base64url');
    const hash = (0, node_crypto_1.createHmac)('sha256', 'refresh').update(raw).digest('hex');
    return { raw, hash, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) };
}
function hashRefreshToken(raw) {
    return (0, node_crypto_1.createHmac)('sha256', 'refresh').update(raw).digest('hex');
}
function bearerFromHeader(header) {
    if (!header)
        return null;
    const [scheme, token] = header.split(' ');
    if (!scheme || !token)
        return null;
    if (scheme.toLowerCase() !== 'bearer')
        return null;
    return token.trim() || null;
}
//# sourceMappingURL=mobile-token.js.map