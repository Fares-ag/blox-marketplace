"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioError = exports.TWILIO_INVALID_RECIPIENT_CODES = exports.DEFAULT_TWILIO_TIMEOUT_MS = exports.TWILIO_API_BASE = void 0;
exports.twilioMessagesUrl = twilioMessagesUrl;
exports.twilioAuthorizationHeader = twilioAuthorizationHeader;
exports.buildTwilioMessageForm = buildTwilioMessageForm;
exports.whatsappAddress = whatsappAddress;
exports.sendTwilioMessage = sendTwilioMessage;
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
exports.TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
exports.DEFAULT_TWILIO_TIMEOUT_MS = 10_000;
exports.TWILIO_INVALID_RECIPIENT_CODES = new Set([
    21211,
    21214,
    21217,
    21408,
    21610,
    21614,
    63003,
]);
class TwilioError extends Error {
    httpStatus;
    code;
    constructor(httpStatus, code, message) {
        super(message);
        this.httpStatus = httpStatus;
        this.code = code;
        this.name = 'TwilioError';
    }
    get invalidRecipient() {
        return this.code !== null && exports.TWILIO_INVALID_RECIPIENT_CODES.has(this.code);
    }
}
exports.TwilioError = TwilioError;
function twilioMessagesUrl(accountSid) {
    return `${exports.TWILIO_API_BASE}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
}
function twilioAuthorizationHeader(creds) {
    return `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`, 'utf8').toString('base64')}`;
}
function buildTwilioMessageForm(input) {
    const form = new URLSearchParams();
    form.set('To', input.to);
    form.set('Body', input.body);
    const from = input.from?.trim();
    const service = input.messagingServiceSid?.trim();
    if (service)
        form.set('MessagingServiceSid', service);
    else if (from)
        form.set('From', from);
    else
        throw new Error('twilio_sender_required');
    return form;
}
function whatsappAddress(value) {
    const trimmed = value.trim();
    return trimmed.toLowerCase().startsWith('whatsapp:') ? `whatsapp:${trimmed.slice('whatsapp:'.length).trim()}` : `whatsapp:${trimmed}`;
}
async function sendTwilioMessage(creds, input, timeoutMs = exports.DEFAULT_TWILIO_TIMEOUT_MS) {
    const form = buildTwilioMessageForm(input);
    const res = await (0, fetch_with_timeout_1.fetchWithTimeout)(twilioMessagesUrl(creds.accountSid), {
        method: 'POST',
        headers: {
            authorization: twilioAuthorizationHeader(creds),
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        body: form.toString(),
    }, timeoutMs);
    const body = (await res.json().catch(() => ({})));
    if (!res.ok) {
        throw new TwilioError(res.status, typeof body.code === 'number' ? body.code : null, body.message ?? `twilio_http_${res.status}`);
    }
    if (!body.sid)
        throw new TwilioError(res.status, null, 'twilio_response_missing_sid');
    return { sid: body.sid, status: body.status ?? 'queued' };
}
//# sourceMappingURL=twilio.js.map