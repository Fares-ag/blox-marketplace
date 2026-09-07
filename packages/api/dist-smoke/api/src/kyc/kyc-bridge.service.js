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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycBridgeService = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const kyc_platform_client_1 = require("./kyc-platform.client");
const kyc_verification_summary_1 = require("./kyc-verification-summary");
const SLOT_CATEGORY = {
    qid_front: client_1.DocumentCategory.qid,
    qid_back: client_1.DocumentCategory.qid,
    passport: client_1.DocumentCategory.passport,
    selfie: client_1.DocumentCategory.selfie,
};
const SLOT_LABELS = {
    qid_front: 'QID Front',
    qid_back: 'QID Back',
    passport: 'Passport',
    selfie: 'Face liveness',
};
function metricScore(value) {
    if (value == null)
        return null;
    if (typeof value === 'number')
        return value;
    if (typeof value === 'object' && typeof value.score === 'number')
        return value.score;
    return null;
}
let KycBridgeService = class KycBridgeService {
    prisma;
    kyc;
    config;
    constructor(prisma, kyc, config) {
        this.prisma = prisma;
        this.kyc = kyc;
        this.config = config;
    }
    verifyWebhookSignature(rawBody, signatureHeader) {
        const secret = this.config.get('KYC_WEBHOOK_SECRET') ?? '';
        if (!secret || !signatureHeader)
            return false;
        const parts = Object.fromEntries(signatureHeader.split(',').map((p) => {
            const [k, ...rest] = p.trim().split('=');
            return [k, rest.join('=')];
        }));
        const timestamp = parts.t;
        const signature = parts.v1;
        if (!timestamp || !signature)
            return false;
        const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
        try {
            return (0, node_crypto_1.timingSafeEqual)(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
        }
        catch {
            return false;
        }
    }
    async ensureSession(user, applicationId) {
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        if (app.customerUserId !== user.id)
            throw new common_1.UnauthorizedException();
        if (!this.kyc.configured())
            throw new common_1.BadRequestException('kyc_not_configured');
        const snap = (app.customerSnapshot ?? {});
        const fullName = `${snap.full_name ?? ''}`.trim() ||
            `${snap.firstName ?? ''} ${snap.lastName ?? ''}`.trim() ||
            user.name;
        let caseId = app.kycCaseId;
        if (!caseId) {
            const existing = await this.kyc.findCaseByExternalRef(applicationId);
            if (existing) {
                caseId = existing.id;
            }
            else {
                const created = await this.kyc.createCase({
                    externalRef: applicationId,
                    fullName,
                    email: app.customerEmail || user.email,
                    phone: `${snap.phone ?? user.phone ?? ''}` || undefined,
                });
                caseId = created.id;
            }
            await this.prisma.application.update({
                where: { id: applicationId },
                data: { kycCaseId: caseId, kycStatus: 'pending' },
            });
        }
        const invite = await this.kyc.createInvite(caseId);
        return {
            case_id: caseId,
            invite_token: invite.invite_token,
            invite_url: invite.invite_url,
            required_slots: [...kyc_platform_client_1.IDENTITY_SLOTS],
        };
    }
    async documentStatus(user, applicationId) {
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        if (app.customerUserId !== user.id)
            throw new common_1.UnauthorizedException();
        if (!app.kycCaseId) {
            return {
                case_status: 'NOT_STARTED',
                kyc_status: app.kycStatus,
                slots: kyc_platform_client_1.IDENTITY_SLOTS.map((type) => ({ type, status: 'missing' })),
            };
        }
        const kase = await this.kyc.getCaseDetail(app.kycCaseId);
        return {
            case_id: app.kycCaseId,
            case_status: kase.status,
            kyc_status: app.kycStatus,
            slots: this.kyc.buildSlotSummary(kase),
        };
    }
    async handleWebhook(rawBody, signature, payload) {
        if (!this.verifyWebhookSignature(rawBody, signature)) {
            throw new common_1.UnauthorizedException('invalid_signature');
        }
        const caseId = payload.case_id;
        if (!caseId)
            throw new common_1.BadRequestException('missing_case_id');
        const kase = await this.kyc.getCaseDetail(caseId);
        const applicationId = kase.external_ref;
        if (!applicationId)
            return { ok: true, skipped: 'no_external_ref' };
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app)
            return { ok: true, skipped: 'application_not_found' };
        await this.syncDocuments(applicationId, app.customerUserId, kase.documents, kase.status);
        return { ok: true };
    }
    async syncDocuments(applicationId, uploadedById, docs, caseStatus) {
        const identity = docs.filter((d) => SLOT_CATEGORY[d.type]);
        for (const doc of identity) {
            const category = SLOT_CATEGORY[doc.type];
            const verified = doc.status === 'PROCESSED' &&
                doc.review_status !== 'fail' &&
                doc.review_status !== 'rejected';
            const rejected = doc.status === 'FAILED' ||
                doc.status === 'REJECTED' ||
                doc.review_status === 'fail' ||
                doc.review_status === 'rejected';
            const verificationStatus = rejected ? 'rejected' : verified ? 'verified' : 'processing';
            const existing = await this.prisma.applicationDocument.findFirst({
                where: { applicationId, kycDocumentType: doc.type },
            });
            const data = {
                category,
                storagePath: `kyc://${doc.id}`,
                mimeType: doc.mime_type ?? 'application/octet-stream',
                uploadedById,
                kycDocumentId: doc.id,
                kycDocumentType: doc.type,
                verificationStatus,
                quality: metricScore(doc.quality),
                authenticity: metricScore(doc.authenticity),
                reviewStatus: doc.review_status,
                originalName: SLOT_LABELS[doc.type] ?? doc.original_filename ?? doc.type,
            };
            if (existing) {
                await this.prisma.applicationDocument.update({ where: { id: existing.id }, data });
            }
            else {
                await this.prisma.applicationDocument.create({
                    data: { applicationId, ...data },
                });
            }
        }
        let kycStatus = 'pending';
        if (caseStatus === 'APPROVED')
            kycStatus = 'verified';
        else if (caseStatus === 'REJECTED')
            kycStatus = 'rejected';
        else if (caseStatus === 'MANUAL_REVIEW')
            kycStatus = 'manual_review';
        else if (identity.some((d) => d.status === 'PROCESSING' || d.status === 'UPLOADED')) {
            kycStatus = 'processing';
        }
        await this.prisma.application.update({
            where: { id: applicationId },
            data: { kycStatus },
        });
    }
    async syncDocumentsForApplication(applicationId) {
        if (!this.kyc.configured())
            return;
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app?.kycCaseId)
            return;
        const kase = await this.kyc.getCaseDetail(app.kycCaseId);
        await this.syncDocuments(applicationId, app.customerUserId, kase.documents, kase.status);
    }
    async readApplicationDocumentBytes(applicationId, doc) {
        if (!doc.storagePath.startsWith('kyc://')) {
            throw new common_1.BadRequestException('not_kyc_document');
        }
        if (!this.kyc.configured())
            throw new common_1.BadRequestException('kyc_not_configured');
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: { kycCaseId: true },
        });
        if (!app?.kycCaseId)
            throw new common_1.NotFoundException('kyc_case_not_linked');
        const kycDocId = doc.kycDocumentId ?? doc.storagePath.slice('kyc://'.length);
        const file = await this.kyc.fetchCaseDocumentFile(app.kycCaseId, kycDocId);
        const ext = node_path_1.default.extname(file.filename) ||
            (file.contentType === 'image/jpeg'
                ? '.jpg'
                : file.contentType === 'image/png'
                    ? '.png'
                    : file.contentType === 'application/pdf'
                        ? '.pdf'
                        : '');
        const baseName = doc.originalName?.trim() || doc.category;
        const filename = node_path_1.default.extname(baseName) ? baseName : `${baseName}${ext}`;
        return {
            buffer: file.buffer,
            contentType: doc.mimeType ?? file.contentType,
            filename,
        };
    }
    async getVerificationSummary(_applicationId, kycCaseId, kycStatus) {
        if (!this.kyc.configured())
            return null;
        const kase = await this.kyc.getCaseDetail(kycCaseId);
        return (0, kyc_verification_summary_1.buildKycVerificationSummary)(kase, kycStatus);
    }
};
exports.KycBridgeService = KycBridgeService;
exports.KycBridgeService = KycBridgeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kyc_platform_client_1.KycPlatformClient,
        config_1.ConfigService])
], KycBridgeService);
//# sourceMappingURL=kyc-bridge.service.js.map