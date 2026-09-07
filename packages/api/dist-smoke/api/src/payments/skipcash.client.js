"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipCashClient = void 0;
exports.mapSkipCashPaid = mapSkipCashPaid;
const node_crypto_1 = require("node:crypto");
class SkipCashClient {
    config;
    constructor(config) {
        this.config = config;
    }
    static fromEnv(env) {
        const secretKey = env.SKIPCASH_SECRET_KEY?.trim() ?? '';
        const keyId = env.SKIPCASH_KEY_ID?.trim() ?? '';
        const clientId = env.SKIPCASH_CLIENT_ID?.trim() ?? '';
        if (!secretKey || !keyId || !clientId)
            return null;
        const useSandbox = env.SKIPCASH_USE_SANDBOX === 'true' || env.SKIPCASH_SANDBOX === 'true';
        const apiUrl = (useSandbox
            ? env.SKIPCASH_SANDBOX_URL?.trim() || 'https://skipcashtest.azurewebsites.net'
            : env.SKIPCASH_PRODUCTION_URL?.trim() || env.SKIPCASH_API_URL?.trim() || 'https://api.skipcash.app').replace(/\/$/, '');
        return new SkipCashClient({ secretKey, keyId, clientId, apiUrl });
    }
    signCreate(parts) {
        const combined = parts.join(',');
        return (0, node_crypto_1.createHmac)('sha256', this.config.secretKey).update(combined).digest('base64');
    }
    signVerify(paymentId) {
        return this.signCreate([`PaymentId=${paymentId}`, `KeyId=${this.config.keyId}`]);
    }
    async createPayment(input) {
        const uid = (0, node_crypto_1.randomUUID)();
        const request = {
            Uid: uid,
            KeyId: this.config.keyId,
            Amount: input.amount.toFixed(2),
            FirstName: input.firstName,
            LastName: input.lastName,
            Phone: input.phone,
            Email: input.email,
            Street: '',
            City: '',
            State: '',
            Country: '',
            PostalCode: '',
            TransactionId: input.transactionId,
            Custom1: input.custom1 ?? '',
        };
        if (input.subject)
            request.Subject = input.subject;
        if (input.description)
            request.Description = input.description;
        if (input.returnUrl)
            request.ReturnUrl = input.returnUrl;
        if (input.webhookUrl)
            request.WebhookUrl = input.webhookUrl;
        if (input.onlyDebitCard !== undefined)
            request.OnlyDebitCard = input.onlyDebitCard;
        const signatureParts = [
            `Uid=${request.Uid}`,
            `KeyId=${request.KeyId}`,
            `Amount=${request.Amount}`,
            `FirstName=${request.FirstName}`,
            `LastName=${request.LastName}`,
            `Phone=${request.Phone}`,
            `Email=${request.Email}`,
        ];
        if (input.transactionId.trim()) {
            signatureParts.push(`TransactionId=${input.transactionId}`);
        }
        if (input.custom1?.trim()) {
            signatureParts.push(`Custom1=${input.custom1}`);
        }
        const res = await fetch(`${this.config.apiUrl}/api/v1/payments`, {
            method: 'POST',
            headers: {
                Authorization: this.signCreate(signatureParts),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });
        const json = (await res.json());
        if (!res.ok) {
            throw new Error(json.message || json.error || `SkipCash create failed (${res.status})`);
        }
        const result = json.resultObj ?? {};
        const id = result.id ?? '';
        const payUrl = result.payUrl || result.paymentUrl || '';
        if (!id || !payUrl) {
            throw new Error('SkipCash create returned incomplete response');
        }
        return { id, payUrl, status: result.status, statusId: result.statusId };
    }
    async getPayment(paymentId) {
        const res = await fetch(`${this.config.apiUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
            method: 'GET',
            headers: {
                Authorization: this.signVerify(paymentId),
                'Content-Type': 'application/json',
            },
        });
        const json = (await res.json());
        if (!res.ok) {
            throw new Error(json.message || json.error || `SkipCash verify failed (${res.status})`);
        }
        const result = (json.resultObj ?? json);
        return {
            id: result.id ?? paymentId,
            status: result.status ?? json.status,
            statusId: result.statusId ?? json.statusId,
            custom1: result.custom1 ?? json.custom1,
        };
    }
}
exports.SkipCashClient = SkipCashClient;
function mapSkipCashPaid(status) {
    if (status === 2)
        return true;
    const s = String(status ?? '').toLowerCase();
    return s === 'paid' || s === 'success' || s === 'completed' || s === 'captured';
}
//# sourceMappingURL=skipcash.client.js.map