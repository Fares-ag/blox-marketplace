"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JWT_TTL_SEC = exports.DEFAULT_FCM_TIMEOUT_MS = exports.GOOGLE_TOKEN_URI = exports.FCM_SCOPE = void 0;
exports.base64url = base64url;
exports.normalizePrivateKey = normalizePrivateKey;
exports.parseServiceAccount = parseServiceAccount;
exports.buildServiceAccountJwt = buildServiceAccountJwt;
exports.decodeJwtSegments = decodeJwtSegments;
exports.stringifyPushData = stringifyPushData;
exports.buildFcmMessage = buildFcmMessage;
exports.fcmSendUrl = fcmSendUrl;
exports.classifyFcmResponse = classifyFcmResponse;
exports.exchangeJwtForAccessToken = exchangeJwtForAccessToken;
exports.sendFcmMessage = sendFcmMessage;
const node_crypto_1 = require("node:crypto");
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
exports.FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
exports.GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
exports.DEFAULT_FCM_TIMEOUT_MS = 10_000;
exports.DEFAULT_JWT_TTL_SEC = 3600;
function base64url(input) {
    return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url');
}
function normalizePrivateKey(key) {
    return key.replace(/\\n/g, '\n').trim();
}
function parseServiceAccount(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        throw new Error('fcm_service_account_empty');
    const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        throw new Error('fcm_service_account_invalid_json');
    }
    const projectId = typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
    const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
    const privateKey = typeof parsed.private_key === 'string' ? normalizePrivateKey(parsed.private_key) : '';
    const tokenUri = typeof parsed.token_uri === 'string' && parsed.token_uri.trim() ? parsed.token_uri.trim() : exports.GOOGLE_TOKEN_URI;
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('fcm_service_account_missing_fields (project_id, client_email, private_key)');
    }
    return { projectId, clientEmail, privateKey, tokenUri };
}
function buildServiceAccountJwt(account, opts = {}) {
    const now = opts.now ?? new Date();
    const ttl = Math.min(Math.max(opts.ttlSec ?? exports.DEFAULT_JWT_TTL_SEC, 60), 3600);
    const iat = Math.floor(now.getTime() / 1000);
    const claims = {
        iss: account.clientEmail,
        scope: opts.scope ?? exports.FCM_SCOPE,
        aud: account.tokenUri,
        iat,
        exp: iat + ttl,
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    const signature = (0, node_crypto_1.createSign)('RSA-SHA256').update(signingInput).end().sign(account.privateKey);
    return { jwt: `${signingInput}.${base64url(signature)}`, claims, expiresAt: new Date(claims.exp * 1000) };
}
function decodeJwtSegments(jwt) {
    const [h, c, s] = jwt.split('.');
    if (!h || !c || !s)
        throw new Error('jwt_malformed');
    return {
        header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')),
        claims: JSON.parse(Buffer.from(c, 'base64url').toString('utf8')),
        signature: Buffer.from(s, 'base64url'),
        signingInput: `${h}.${c}`,
    };
}
function stringifyPushData(data) {
    const out = {};
    for (const [key, value] of Object.entries(data ?? {})) {
        if (value === null || value === undefined || value === '')
            continue;
        out[key] = String(value);
    }
    return out;
}
function buildFcmMessage(token, payload) {
    const body = payload.body?.trim() || undefined;
    const data = stringifyPushData({ ...(payload.data ?? {}), link_path: payload.linkPath ?? undefined });
    return {
        message: {
            token,
            notification: { title: payload.title, ...(body ? { body } : {}) },
            ...(Object.keys(data).length ? { data } : {}),
            android: { priority: 'high', notification: { channel_id: 'default', sound: 'default' } },
            apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
        },
    };
}
function fcmSendUrl(projectId) {
    return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}
function classifyFcmResponse(status, body) {
    if (status >= 200 && status < 300)
        return { outcome: 'sent', code: null, message: null };
    const error = body?.error;
    const detailCode = error?.details?.find((d) => typeof d.errorCode === 'string')?.errorCode ?? null;
    const code = detailCode ?? error?.status ?? `http_${status}`;
    const message = error?.message ?? null;
    const tokenInvalid = status === 404 ||
        detailCode === 'UNREGISTERED' ||
        error?.status === 'NOT_FOUND' ||
        (status === 400 && /registration token/i.test(message ?? ''));
    return { outcome: tokenInvalid ? 'unregistered' : 'error', code, message };
}
async function exchangeJwtForAccessToken(tokenUri, jwt, timeoutMs = exports.DEFAULT_FCM_TIMEOUT_MS) {
    const form = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
    });
    const res = await (0, fetch_with_timeout_1.fetchWithTimeout)(tokenUri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }, timeoutMs);
    const body = (await res.json().catch(() => ({})));
    if (!res.ok || !body.access_token) {
        throw new Error(`fcm_token_exchange_failed: ${body.error ?? res.status} ${body.error_description ?? ''}`.trim());
    }
    const ttlSec = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : exports.DEFAULT_JWT_TTL_SEC;
    return { accessToken: body.access_token, expiresAt: new Date(Date.now() + ttlSec * 1000) };
}
async function sendFcmMessage(accessToken, projectId, message, timeoutMs = exports.DEFAULT_FCM_TIMEOUT_MS) {
    const res = await (0, fetch_with_timeout_1.fetchWithTimeout)(fcmSendUrl(projectId), {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(message),
    }, timeoutMs);
    const body = await res.json().catch(() => null);
    return classifyFcmResponse(res.status, body);
}
//# sourceMappingURL=fcm.js.map