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
var WhatsAppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
exports.resolveWhatsAppProvider = resolveWhatsAppProvider;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
const sms_service_1 = require("./sms.service");
const twilio_1 = require("./twilio");
function resolveWhatsAppProvider(raw) {
    const value = (raw ?? '').trim().toLowerCase();
    if (value === 'twilio')
        return 'twilio';
    if (value === 'http')
        return 'http';
    return 'log';
}
let WhatsAppService = WhatsAppService_1 = class WhatsAppService {
    logger = new common_1.Logger(WhatsAppService_1.name);
    provider;
    twilio;
    twilioFrom;
    twilioTimeoutMs;
    httpUrl;
    httpToken;
    constructor(config) {
        this.provider = resolveWhatsAppProvider(config.get('WHATSAPP_PROVIDER'));
        const accountSid = config.get('TWILIO_ACCOUNT_SID')?.trim() || null;
        const authToken = config.get('TWILIO_AUTH_TOKEN')?.trim() || null;
        this.twilio = accountSid && authToken ? { accountSid, authToken } : null;
        const from = config.get('TWILIO_WHATSAPP_FROM')?.trim() || null;
        this.twilioFrom = from ? (0, twilio_1.whatsappAddress)(from) : null;
        this.twilioTimeoutMs = (0, fetch_with_timeout_1.resolveHttpTimeoutMs)(config.get('TWILIO_HTTP_TIMEOUT_MS'), twilio_1.DEFAULT_TWILIO_TIMEOUT_MS);
        this.httpUrl = config.get('WHATSAPP_HTTP_URL')?.trim() || null;
        this.httpToken = config.get('WHATSAPP_HTTP_TOKEN')?.trim() || null;
        if (this.provider === 'twilio') {
            if (!this.twilio)
                throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when WHATSAPP_PROVIDER=twilio');
            if (!this.twilioFrom)
                throw new Error('TWILIO_WHATSAPP_FROM is required when WHATSAPP_PROVIDER=twilio');
        }
        if (this.provider === 'http' && !this.httpUrl) {
            throw new Error('WHATSAPP_HTTP_URL is required when WHATSAPP_PROVIDER=http');
        }
    }
    get isLive() {
        return this.provider !== 'log';
    }
    get providerName() {
        return this.provider;
    }
    async send(message) {
        const to = (0, sms_service_1.normalizePhone)(message.to);
        if (!to)
            throw new Error('whatsapp_invalid_recipient');
        switch (this.provider) {
            case 'log':
                this.logger.log(`[whatsapp:${message.kind}] to=${to} body=${JSON.stringify(message.body)}`);
                return { delivered: false, provider: 'log' };
            case 'twilio':
                return this.sendViaTwilio(to, message);
            case 'http':
                return this.sendViaHttp(to, message);
        }
    }
    async sendViaTwilio(to, message) {
        try {
            const result = await (0, twilio_1.sendTwilioMessage)(this.twilio, { to: (0, twilio_1.whatsappAddress)(to), body: message.body, from: this.twilioFrom }, this.twilioTimeoutMs);
            return { delivered: true, provider: 'twilio', id: result.sid };
        }
        catch (err) {
            if (err instanceof twilio_1.TwilioError) {
                this.logger.error(`Twilio WhatsApp failed kind=${message.kind} http=${err.httpStatus} code=${err.code ?? 'n/a'}: ${err.message}`);
                throw new Error(err.invalidRecipient ? 'whatsapp_invalid_recipient' : 'whatsapp_gateway_error');
            }
            const detail = err instanceof Error ? err.message : String(err);
            this.logger.error(`Twilio WhatsApp request failed kind=${message.kind}: ${detail}`);
            throw new Error('whatsapp_gateway_error');
        }
    }
    async sendViaHttp(to, message) {
        const res = await fetch(this.httpUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(this.httpToken ? { authorization: `Bearer ${this.httpToken}` } : {}),
            },
            body: JSON.stringify({ to, body: message.body, kind: message.kind, channel: 'whatsapp' }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            this.logger.error(`WhatsApp gateway responded ${res.status} for kind=${message.kind}`);
            throw new Error('whatsapp_gateway_error');
        }
        return { delivered: true, provider: 'http' };
    }
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = WhatsAppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map