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
var ZohoCrmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZohoCrmService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const storage_service_1 = require("../../storage/storage.service");
const kyc_bridge_service_1 = require("../../kyc/kyc-bridge.service");
const activity_service_1 = require("../../common/activity.service");
const fetch_with_timeout_1 = require("../../common/fetch-with-timeout");
const identity_service_1 = require("../../common/identity.service");
const zoho_auth_service_1 = require("./zoho-auth.service");
const zoho_config_1 = require("./zoho-config");
const zoho_lead_mapper_1 = require("./zoho-lead.mapper");
function extensionFor(mimeType) {
    switch ((mimeType ?? '').toLowerCase()) {
        case 'application/pdf':
            return '.pdf';
        case 'image/jpeg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        case 'image/heic':
            return '.heic';
        default:
            return '';
    }
}
let ZohoCrmService = ZohoCrmService_1 = class ZohoCrmService {
    prisma;
    auth;
    config;
    activity;
    storage;
    kycBridge;
    identity;
    logger = new common_1.Logger(ZohoCrmService_1.name);
    constructor(prisma, auth, config, activity, storage, kycBridge, identity) {
        this.prisma = prisma;
        this.auth = auth;
        this.config = config;
        this.activity = activity;
        this.storage = storage;
        this.kycBridge = kycBridge;
        this.identity = identity;
    }
    async syncApplicationToZoho(applicationId, actorUserId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                product: true,
                company: { select: { id: true, name: true } },
                offer: true,
                financePartner: true,
                documents: true,
                customer: { select: { qid: true, qidEnc: true } },
            },
        });
        if (!app)
            return { zohoLeadId: null, error: 'application_not_found' };
        if (app.financePartner?.crmAdapter !== 'zoho') {
            return { zohoLeadId: null, error: 'partner_not_zoho' };
        }
        if (!this.config.enabled) {
            const configError = this.config.configurationError;
            if (!configError) {
                this.logger.error(`Zoho sync skipped for ${applicationId}: no credentials configured, ` +
                    `but partner "${app.financePartner?.code}" is routed to Zoho.`);
                await this.recordFailure(applicationId, 'zoho_not_configured', actorUserId);
                return { zohoLeadId: null, error: 'zoho_not_configured' };
            }
            this.logger.error(`Zoho sync skipped for ${applicationId}: ${configError}. Set ZOHO_API_DOMAIN explicitly.`);
            await this.recordFailure(applicationId, configError, actorUserId);
            return { zohoLeadId: null, error: 'zoho_misconfigured' };
        }
        try {
            const leadPayload = (0, zoho_lead_mapper_1.mapApplicationToZohoLead)(app, this.config.requestSubmittedTo, this.config.leadSource, { qid: this.identity.readQid(app.customer) });
            let leadId = app.zohoLeadId;
            if (leadId) {
                const outcome = await this.updateLead(leadId, leadPayload);
                if (outcome === 'not_found') {
                    this.logger.warn(`Zoho lead ${leadId} no longer exists for application ${applicationId}; re-linking.`);
                    leadId = null;
                }
            }
            if (!leadId) {
                const existingId = await this.findLeadIdByEmail(app.customerEmail);
                if (existingId) {
                    const outcome = await this.updateLead(existingId, leadPayload);
                    leadId = outcome === 'not_found' ? await this.createLead(leadPayload) : existingId;
                }
                else {
                    leadId = await this.createLead(leadPayload);
                }
            }
            if (!leadId)
                throw new Error('zoho_lead_resolution_failed');
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { zohoLeadId: leadId },
            });
            const { uploaded: documentsUploaded, failed: documentsFailed } = await this.syncDocuments(applicationId, leadId, app.documents);
            if (documentsFailed > 0) {
                await this.recordFailure(applicationId, `zoho_attachments_incomplete:${documentsFailed}`, actorUserId);
                return { zohoLeadId: leadId, documentsUploaded, error: 'zoho_attachments_incomplete' };
            }
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    zohoSyncedAt: new Date(),
                    zohoSyncError: null,
                    zohoSyncAttempts: 0,
                    zohoNextRetryAt: null,
                },
            });
            await this.activity.log({
                actorUserId,
                entityType: 'application',
                entityId: applicationId,
                action: 'crm_export',
                toValue: leadId,
                metadata: {
                    provider: 'zoho',
                    partnerCode: app.financePartner?.code,
                    documentsUploaded,
                },
            });
            return { zohoLeadId: leadId, documentsUploaded };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'zoho_sync_failed';
            this.logger.error(`Zoho sync failed for ${applicationId}: ${message}`);
            await this.recordFailure(applicationId, message, actorUserId);
            return { zohoLeadId: null, error: message };
        }
    }
    async recordFailure(applicationId, message, actorUserId) {
        try {
            const current = await this.prisma.application.findUnique({
                where: { id: applicationId },
                select: { zohoSyncAttempts: true },
            });
            const attempts = (current?.zohoSyncAttempts ?? 0) + 1;
            const backoffMinutes = Math.min(Math.pow(2, attempts) * 5, 24 * 60);
            await this.prisma.application.update({
                where: { id: applicationId },
                data: {
                    zohoSyncError: message.slice(0, 500),
                    zohoSyncAttempts: attempts,
                    zohoNextRetryAt: new Date(Date.now() + backoffMinutes * 60_000),
                },
            });
        }
        catch {
        }
        try {
            await this.activity.log({
                actorUserId,
                entityType: 'application',
                entityId: applicationId,
                action: 'crm_export_failed',
                toValue: message.slice(0, 200),
                metadata: { provider: 'zoho' },
            });
        }
        catch {
        }
    }
    zohoFetch(url, init = {}) {
        return (0, fetch_with_timeout_1.fetchWithTimeout)(url, init, this.config.httpTimeoutMs);
    }
    async createLead(payload) {
        const token = await this.auth.getAccessToken();
        const res = await this.zohoFetch(`${this.config.apiDomain}/crm/v8/Leads`, {
            method: 'POST',
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: [payload] }),
        });
        const body = (await res.json());
        if (!res.ok) {
            throw new Error(JSON.stringify(body));
        }
        const row = body.data?.[0];
        if (row?.code !== 'SUCCESS' || !row.details?.id) {
            throw new Error(row?.message ?? JSON.stringify(body));
        }
        return row.details.id;
    }
    async updateLead(id, payload) {
        const token = await this.auth.getAccessToken();
        const res = await this.zohoFetch(`${this.config.apiDomain}/crm/v8/Leads/${id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: [payload] }),
        });
        if (res.status === 404)
            return 'not_found';
        const body = (await res.json());
        if (!res.ok) {
            throw new Error(JSON.stringify(body));
        }
        const row = body.data?.[0];
        if (row?.code === 'RESOURCE_NOT_FOUND')
            return 'not_found';
        if (row?.code !== 'SUCCESS') {
            throw new Error(row?.message ?? JSON.stringify(body));
        }
        return 'updated';
    }
    async findLeadIdByEmail(email) {
        const token = await this.auth.getAccessToken();
        const res = await this.zohoFetch(`${this.config.apiDomain}/crm/v8/Leads/search?email=${encodeURIComponent(email)}`, {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        if (res.status === 204)
            return null;
        if (!res.ok) {
            this.logger.warn(`Zoho lead search failed (${res.status}) for ${email}; a duplicate lead may be created.`);
            return null;
        }
        const body = (await res.json());
        return body.data?.[0]?.id ?? null;
    }
    async syncDocuments(applicationId, leadId, documents) {
        if (documents.length === 0)
            return { uploaded: 0, failed: 0 };
        const existingNames = await this.listAttachmentNames(leadId);
        let uploaded = 0;
        let failed = 0;
        for (const doc of documents) {
            const fromPath = doc.storagePath.split('/').pop() ?? '';
            const source = doc.originalName?.trim() || fromPath || `${doc.category}`;
            const safe = source.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100);
            const hasExt = /\.[A-Za-z0-9]{2,5}$/.test(safe);
            const ext = hasExt ? '' : extensionFor(doc.mimeType) || '.pdf';
            const fileName = `blox-${doc.category}-${safe}${ext}`;
            if (existingNames.has(fileName))
                continue;
            try {
                const file = doc.storagePath.startsWith('kyc://')
                    ? await this.kycBridge.readApplicationDocumentBytes(applicationId, doc)
                    : await this.storage.readKyc(doc.storagePath).then(({ buffer, contentType }) => ({
                        buffer,
                        contentType,
                        filename: doc.originalName?.trim() || doc.category,
                    }));
                await this.uploadAttachment(leadId, fileName, file.buffer, file.contentType);
                existingNames.add(fileName);
                uploaded += 1;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'attachment_upload_failed';
                this.logger.warn(`Zoho attachment upload failed (${doc.category}): ${message}`);
                failed += 1;
            }
        }
        return { uploaded, failed };
    }
    async listAttachmentNames(leadId) {
        const token = await this.auth.getAccessToken();
        const res = await this.zohoFetch(`${this.config.apiDomain}/crm/v8/Leads/${leadId}/Attachments?fields=id,File_Name,Size`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
        if (res.status === 204)
            return new Set();
        if (!res.ok) {
            const text = await res.text();
            this.logger.warn(`Zoho attachment list failed (${res.status}): ${text.slice(0, 200)}`);
            return new Set();
        }
        const body = (await res.json());
        const names = (body.data ?? [])
            .map((row) => row.File_Name ?? row.file_name ?? '')
            .filter(Boolean);
        return new Set(names);
    }
    async uploadAttachment(leadId, fileName, buffer, contentType) {
        const token = await this.auth.getAccessToken();
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' }), fileName);
        const res = await this.zohoFetch(`${this.config.apiDomain}/crm/v8/Leads/${leadId}/Attachments`, {
            method: 'POST',
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
            body: form,
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`attachment_upload_failed (${res.status}): ${text.slice(0, 300)}`);
        }
        let body;
        try {
            body = JSON.parse(text);
        }
        catch {
            return;
        }
        const row = body.data?.[0];
        if (row && row.code !== 'SUCCESS') {
            throw new Error(row.message ?? text.slice(0, 300));
        }
    }
};
exports.ZohoCrmService = ZohoCrmService;
exports.ZohoCrmService = ZohoCrmService = ZohoCrmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        zoho_auth_service_1.ZohoAuthService,
        zoho_config_1.ZohoConfig,
        activity_service_1.ActivityService,
        storage_service_1.StorageService,
        kyc_bridge_service_1.KycBridgeService,
        identity_service_1.IdentityService])
], ZohoCrmService);
//# sourceMappingURL=zoho-crm.service.js.map