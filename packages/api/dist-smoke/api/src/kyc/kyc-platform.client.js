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
var KycPlatformClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycPlatformClient = exports.IDENTITY_SLOTS = void 0;
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
exports.IDENTITY_SLOTS = ['qid_front', 'qid_back', 'passport', 'selfie'];
let KycPlatformClient = KycPlatformClient_1 = class KycPlatformClient {
    config;
    logger = new common_1.Logger(KycPlatformClient_1.name);
    constructor(config) {
        this.config = config;
    }
    baseUrl() {
        return (this.config.get('KYC_API_BASE_URL') ?? '').replace(/\/$/, '');
    }
    headers() {
        return {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-api-key': this.config.get('KYC_API_KEY') ?? '',
            'x-tenant-id': this.config.get('KYC_TENANT_ID') ?? '',
        };
    }
    configured() {
        return Boolean(this.baseUrl() && this.config.get('KYC_API_KEY'));
    }
    async kycFetch(path, init) {
        const res = await fetch(`${this.baseUrl()}${path}`, {
            ...init,
            headers: { ...this.headers(), ...init?.headers },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = body.message ?? `KYC API ${res.status}`;
            this.logger.warn(msg);
            throw new Error(msg);
        }
        return body;
    }
    extractInviteToken(inviteUrl) {
        const marker = '/onboard/';
        const idx = inviteUrl.indexOf(marker);
        if (idx < 0)
            throw new Error('Invalid invite URL');
        const rest = inviteUrl.slice(idx + marker.length);
        const end = rest.search(/[?#\s]/);
        return end >= 0 ? rest.slice(0, end) : rest;
    }
    async findCaseByExternalRef(externalRef) {
        try {
            return await this.kycFetch(`/api/v1/cases/by-external-ref/${encodeURIComponent(externalRef)}`);
        }
        catch (err) {
            if (String(err).includes('404') || String(err).toLowerCase().includes('not found'))
                return null;
            throw err;
        }
    }
    async createCase(input) {
        return this.kycFetch('/api/v1/cases', {
            method: 'POST',
            body: JSON.stringify({
                external_ref: input.externalRef,
                required_documents: ['qid', 'passport'],
                locale: 'en',
                customer: {
                    full_name: input.fullName,
                    contact: { email: input.email, phone: input.phone },
                },
            }),
        });
    }
    async createInvite(caseId) {
        const res = await this.kycFetch(`/api/v1/cases/${caseId}/invite`, { method: 'POST', body: '{}' });
        const token = res.invite_token ?? this.extractInviteToken(res.invite_url);
        return { invite_url: res.invite_url, invite_token: token };
    }
    async getCaseDetail(caseId) {
        return this.kycFetch(`/api/v1/cases/${caseId}`);
    }
    async fetchCaseDocumentFile(caseId, documentId) {
        const res = await fetch(`${this.baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/file`, { headers: this.headers() });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.warn(`KYC document fetch failed (${res.status}): ${body.slice(0, 200)}`);
            throw new Error(`KYC document ${documentId} unavailable (${res.status})`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
        const disposition = res.headers.get('content-disposition') ?? '';
        const match = disposition.match(/filename="([^"]+)"/);
        return {
            buffer,
            contentType,
            filename: match?.[1] ?? documentId,
        };
    }
    buildSlotSummary(kase) {
        const latestByType = new Map();
        for (const doc of kase.documents)
            latestByType.set(doc.type, doc);
        return exports.IDENTITY_SLOTS.map((type) => {
            const doc = latestByType.get(type);
            if (!doc)
                return { type, status: 'missing' };
            return {
                type,
                document_id: doc.id,
                status: doc.status,
                review_status: doc.review_status ?? 'pending',
                quality: doc.quality,
                authenticity: doc.authenticity,
            };
        });
    }
};
exports.KycPlatformClient = KycPlatformClient;
exports.KycPlatformClient = KycPlatformClient = KycPlatformClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], KycPlatformClient);
//# sourceMappingURL=kyc-platform.client.js.map