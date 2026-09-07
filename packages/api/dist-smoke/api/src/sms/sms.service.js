"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SmsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
exports.resolveSmsProvider = resolveSmsProvider;
exports.normalizePhone = normalizePhone;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
const twilio_1 = require("./twilio");
function resolveSmsProvider(raw) {
    const value = (raw ?? '').trim().toLowerCase();
    if (value === 'http')
        return 'http';
    if (value === 'twilio')
        return 'twilio';
    return 'log';
}
let SmsService = SmsService_1 = class SmsService {
    logger = new common_1.Logger(SmsService_1.name);
    provider;
    httpUrl;
    httpToken;
    sender;
    twilio;
    twilioFrom;
    twilioMessagingServiceSid;
    twilioTimeoutMs;
    constructor(config) {
        const isProduction = process.env.NODE_ENV === 'production';
        this.provider = resolveSmsProvider(config.get('SMS_PROVIDER'));
        this.httpUrl = config.get('SMS_HTTP_URL')?.trim() || null;
        this.httpToken = config.get('SMS_HTTP_TOKEN')?.trim() || null;
        this.sender = config.get('SMS_SENDER_ID')?.trim() || 'Blox';
        const accountSid = config.get('TWILIO_ACCOUNT_SID')?.trim() || null;
        const authToken = config.get('TWILIO_AUTH_TOKEN')?.trim() || null;
        this.twilio = accountSid && authToken ? { accountSid, authToken } : null;
        this.twilioFrom = config.get('TWILIO_FROM')?.trim() || null;
        this.twilioMessagingServiceSid = config.get('TWILIO_MESSAGING_SERVICE_SID')?.trim() || null;
        this.twilioTimeoutMs = (0, fetch_with_timeout_1.resolveHttpTimeoutMs)(config.get('TWILIO_HTTP_TIMEOUT_MS'), twilio_1.DEFAULT_TWILIO_TIMEOUT_MS);
        if (this.provider === 'http' && !this.httpUrl) {
            throw new Error('SMS_HTTP_URL is required when SMS_PROVIDER=http');
        }
        if (this.provider === 'twilio') {
            if (!this.twilio)
                throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when SMS_PROVIDER=twilio');
            if (!this.twilioFrom && !this.twilioMessagingServiceSid) {
                throw new Error('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID is required when SMS_PROVIDER=twilio');
            }
        }
        if (isProduction && this.provider === 'log') {
            this.logger.warn('SMS_PROVIDER is not configured — OTPs and SMS notifications will only be logged');
        }
    }
    get isLive() {
        return this.provider !== 'log';
    }
    get providerName() {
        return this.provider;
    }
    async send(message) {
        const to = normalizePhone(message.to);
        if (!to)
            throw new Error('sms_invalid_recipient');
        switch (this.provider) {
            case 'log':
                this.logger.log(`[sms:${message.kind}] to=${to} body=${JSON.stringify(message.body)}`);
                return { delivered: false, provider: 'log' };
            case 'twilio':
                return this.sendViaTwilio(to, message);
            case 'http':
                return this.sendViaHttp(to, message);
        }
    }
    async sendViaHttp(to, message) {
        const res = await fetch(this.httpUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(this.httpToken ? { authorization: `Bearer ${this.httpToken}` } : {}),
            },
            body: JSON.stringify({ to, body: message.body, sender: this.sender, kind: message.kind }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            this.logger.error(`SMS gateway responded ${res.status} for kind=${message.kind}`);
            throw new Error('sms_gateway_error');
        }
        return { delivered: true, provider: 'http' };
    }
    async sendViaTwilio(to, message) {
        try {
            const result = await (0, twilio_1.sendTwilioMessage)(this.twilio, { to, body: message.body, from: this.twilioFrom, messagingServiceSid: this.twilioMessagingServiceSid }, this.twilioTimeoutMs);
            return { delivered: true, provider: 'twilio', id: result.sid };
        }
        catch (err) {
            if (err instanceof twilio_1.TwilioError) {
                this.logger.error(`Twilio SMS failed kind=${message.kind} http=${err.httpStatus} code=${err.code ?? 'n/a'}: ${err.message}`);
                throw new Error(err.invalidRecipient ? 'sms_invalid_recipient' : 'sms_gateway_error');
            }
            const detail = err instanceof Error ? err.message : String(err);
            this.logger.error(`Twilio SMS request failed kind=${message.kind}: ${detail}`);
            throw new Error('sms_gateway_error');
        }
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = SmsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SmsService);
function normalizePhone(raw) {
    const digits = String(raw ?? '').replace(/[^\d+]/g, '');
    if (!digits)
        return null;
    if (digits.startsWith('+'))
        return digits.length >= 9 ? digits : null;
    if (digits.startsWith('00'))
        return `+${digits.slice(2)}`;
    if (digits.length === 8)
        return `+974${digits}`;
    if (digits.startsWith('974') && digits.length === 11)
        return `+${digits}`;
    return digits.length >= 9 ? `+${digits}` : null;
}
//# sourceMappingURL=sms.service.js.map