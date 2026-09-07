"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePostmarkServerToken = resolvePostmarkServerToken;
exports.resolvePostmarkHttpTimeoutMs = resolvePostmarkHttpTimeoutMs;
exports.sendPostmarkEmail = sendPostmarkEmail;
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';
const DEFAULT_POSTMARK_HTTP_TIMEOUT_MS = 30_000;
function resolvePostmarkServerToken(config) {
    const explicit = config.get('POSTMARK_SERVER_TOKEN')?.trim();
    if (explicit)
        return explicit;
    const host = config.get('SMTP_HOST')?.trim().toLowerCase() ?? '';
    const user = config.get('SMTP_USER')?.trim();
    if (host.includes('postmarkapp.com') && user)
        return user;
    return null;
}
function resolvePostmarkHttpTimeoutMs(config) {
    return (0, fetch_with_timeout_1.resolveHttpTimeoutMs)(config.get('POSTMARK_HTTP_TIMEOUT_MS'), DEFAULT_POSTMARK_HTTP_TIMEOUT_MS);
}
async function sendPostmarkEmail(input) {
    const timeoutMs = input.timeoutMs ?? DEFAULT_POSTMARK_HTTP_TIMEOUT_MS;
    const res = await (0, fetch_with_timeout_1.fetchWithTimeout)(POSTMARK_API_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': input.token,
        },
        body: JSON.stringify({
            From: input.from,
            To: input.to,
            Subject: input.subject,
            TextBody: input.text,
            ...(input.html ? { HtmlBody: input.html } : {}),
            MessageStream: 'outbound',
        }),
    }, timeoutMs);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Postmark HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
}
//# sourceMappingURL=postmark-mail.js.map