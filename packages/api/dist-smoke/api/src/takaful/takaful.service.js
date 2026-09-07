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
exports.TakafulService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const application_access_1 = require("../applications/application-access");
const activity_service_1 = require("../common/activity.service");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_service_1 = require("../storage/storage.service");
const customer_profile_1 = require("../customers/customer-profile");
const vault_logic_1 = require("../customers/vault-logic");
const takaful_dto_1 = require("./takaful-dto");
const LOCKED_STATUSES = [client_1.TakafulStatus.active, client_1.TakafulStatus.closed];
let TakafulService = class TakafulService {
    prisma;
    storage;
    activity;
    constructor(prisma, storage, activity) {
        this.prisma = prisma;
        this.storage = storage;
        this.activity = activity;
    }
    async listForCustomer(user, applicationId) {
        const app = await this.ownedApplication(user, applicationId);
        return this.listDto(app.id);
    }
    async listForOps(user, applicationId) {
        const app = await this.viewableApplication(user, applicationId);
        return this.listDto(app.id);
    }
    async declare(user, applicationId, input) {
        const app = await this.ownedApplication(user, applicationId);
        if (app.status === client_1.ApplicationStatus.completed)
            throw new common_1.ConflictException('application_completed');
        if (!input.declaration_accepted)
            throw new common_1.BadRequestException('takaful_declaration_required');
        const dates = this.parseDates(input);
        const policy = await this.prisma.takafulPolicy.create({
            data: {
                applicationId: app.id,
                provider: input.provider.trim(),
                policyNumber: input.policy_number.trim(),
                coverageType: input.coverage_type,
                coverageAmount: input.coverage_amount ?? null,
                premiumAmount: input.premium_amount ?? null,
                effectiveFrom: dates.effectiveFrom,
                expiresAt: dates.expiresAt,
                riders: input.riders ? (0, takaful_dto_1.ridersFromJson)(input.riders) : undefined,
                status: client_1.TakafulStatus.declared,
                declarationAcceptedAt: new Date(),
                declarationVersion: takaful_dto_1.TAKAFUL_DECLARATION_VERSION,
                createdByUserId: user.id,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'takaful_policy',
            entityId: policy.id,
            action: 'takaful_declared',
            toValue: client_1.TakafulStatus.declared,
            metadata: {
                application_id: app.id,
                provider: policy.provider,
                coverage_type: policy.coverageType,
                declaration_version: takaful_dto_1.TAKAFUL_DECLARATION_VERSION,
            },
        });
        return (0, takaful_dto_1.toTakafulPolicyDto)(policy);
    }
    async update(user, applicationId, policyId, input) {
        const app = await this.ownedApplication(user, applicationId);
        const policy = await this.policyOf(app.id, policyId);
        if (LOCKED_STATUSES.includes(policy.status))
            throw new common_1.ConflictException('takaful_policy_locked');
        const dates = this.parseDates(input);
        const data = {};
        const changed = [];
        if (input.provider !== undefined) {
            data.provider = input.provider.trim();
            changed.push('provider');
        }
        if (input.policy_number !== undefined) {
            data.policyNumber = input.policy_number.trim();
            changed.push('policy_number');
        }
        if (input.coverage_type !== undefined) {
            data.coverageType = input.coverage_type;
            changed.push('coverage_type');
        }
        if (input.coverage_amount !== undefined) {
            data.coverageAmount = input.coverage_amount;
            changed.push('coverage_amount');
        }
        if (input.premium_amount !== undefined) {
            data.premiumAmount = input.premium_amount;
            changed.push('premium_amount');
        }
        if (input.effective_from !== undefined) {
            data.effectiveFrom = dates.effectiveFrom;
            changed.push('effective_from');
        }
        if (input.expires_at !== undefined) {
            data.expiresAt = dates.expiresAt;
            data.lastReminderKind = null;
            data.lastReminderAt = null;
            changed.push('expires_at');
        }
        if (input.riders !== undefined) {
            data.riders = (0, takaful_dto_1.ridersFromJson)(input.riders);
            changed.push('riders');
        }
        let toStatus = null;
        if (policy.status === client_1.TakafulStatus.expired &&
            dates.expiresAt &&
            dates.expiresAt.getTime() >= (0, vault_logic_1.startOfUtcDay)().getTime()) {
            toStatus = client_1.TakafulStatus.declared;
            data.status = toStatus;
            data.verifiedAt = null;
            data.verifiedById = null;
        }
        if (!changed.length)
            return (0, takaful_dto_1.toTakafulPolicyDto)(policy);
        const updated = await this.prisma.takafulPolicy.update({ where: { id: policy.id }, data });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'takaful_policy',
            entityId: policy.id,
            action: 'takaful_updated',
            fromValue: policy.status,
            toValue: toStatus ?? policy.status,
            metadata: { application_id: app.id, fields: changed },
        });
        return (0, takaful_dto_1.toTakafulPolicyDto)(updated);
    }
    async uploadDocument(user, applicationId, policyId, file) {
        const app = await this.ownedApplication(user, applicationId);
        const policy = await this.policyOf(app.id, policyId);
        if (LOCKED_STATUSES.includes(policy.status))
            throw new common_1.ConflictException('takaful_policy_locked');
        this.storage.assertCustomerUploadFile(file);
        const upload = file;
        const documentPath = await this.storage.uploadTakafulDocument(upload, app.id, policy.id);
        const updated = await this.prisma.takafulPolicy.update({
            where: { id: policy.id },
            data: { documentPath, documentMime: upload.mimetype, status: client_1.TakafulStatus.pending_verification },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'takaful_policy',
            entityId: policy.id,
            action: 'takaful_document_uploaded',
            fromValue: policy.status,
            toValue: client_1.TakafulStatus.pending_verification,
            metadata: { application_id: app.id, mime_type: upload.mimetype },
        });
        await this.notifyVerifiers(app.companyId, app.id, policy.policyNumber);
        return (0, takaful_dto_1.toTakafulPolicyDto)(updated);
    }
    async downloadDocument(user, applicationId, policyId) {
        const app = user.role === client_1.UserRole.customer
            ? await this.ownedApplication(user, applicationId)
            : await this.viewableApplication(user, applicationId);
        const policy = await this.policyOf(app.id, policyId);
        if (!policy.documentPath)
            throw new common_1.NotFoundException('takaful_document_not_found');
        const file = await this.storage.readKyc(policy.documentPath);
        const ext = node_path_1.default.extname(policy.documentPath) || '';
        const filename = `takaful-${(policy.policyNumber ?? policy.id).replace(/[^\w.-]+/g, '_')}${ext}`;
        return { buffer: file.buffer, contentType: policy.documentMime ?? file.contentType, filename };
    }
    async verify(user, applicationId, policyId) {
        const app = await this.viewableApplication(user, applicationId);
        const policy = await this.policyOf(app.id, policyId);
        if (policy.status === client_1.TakafulStatus.active)
            throw new common_1.ConflictException('takaful_already_active');
        if (policy.status !== client_1.TakafulStatus.declared && policy.status !== client_1.TakafulStatus.pending_verification) {
            throw new common_1.ConflictException('invalid_status_transition');
        }
        const updated = await this.prisma.takafulPolicy.update({
            where: { id: policy.id },
            data: { status: client_1.TakafulStatus.active, verifiedAt: new Date(), verifiedById: user.id },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'takaful_policy',
            entityId: policy.id,
            action: 'takaful_verified',
            fromValue: policy.status,
            toValue: client_1.TakafulStatus.active,
            metadata: { application_id: app.id },
        });
        await this.activity.notify(app.customerUserId, 'Takaful policy verified', `Your takaful policy${policy.policyNumber ? ` ${policy.policyNumber}` : ''} has been verified and is now active.`, `/app/applications/${app.id}`);
        return (0, takaful_dto_1.toTakafulPolicyDto)(updated);
    }
    async listDto(applicationId) {
        const policies = await this.prisma.takafulPolicy.findMany({
            where: { applicationId },
            orderBy: { createdAt: 'desc' },
        });
        const now = new Date();
        return policies.map((p) => (0, takaful_dto_1.toTakafulPolicyDto)(p, now));
    }
    async loadApplication(applicationId) {
        return this.prisma.application.findUnique({
            where: { id: applicationId },
            select: { id: true, customerUserId: true, companyId: true, status: true },
        });
    }
    async ownedApplication(user, applicationId) {
        const app = await this.loadApplication(applicationId);
        if (!app || app.customerUserId !== user.id)
            throw new common_1.NotFoundException('application_not_found');
        return app;
    }
    async viewableApplication(user, applicationId) {
        const app = await this.loadApplication(applicationId);
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        return app;
    }
    async policyOf(applicationId, policyId) {
        const policy = await this.prisma.takafulPolicy.findFirst({ where: { id: policyId, applicationId } });
        if (!policy)
            throw new common_1.NotFoundException('takaful_policy_not_found');
        return policy;
    }
    parseDates(input) {
        const effectiveFrom = input.effective_from ? (0, customer_profile_1.parseIsoDate)(input.effective_from) : null;
        if (input.effective_from && !effectiveFrom)
            throw new common_1.BadRequestException('effective_from_invalid');
        const expiresAt = input.expires_at ? (0, customer_profile_1.parseIsoDate)(input.expires_at) : null;
        if (input.expires_at && !expiresAt)
            throw new common_1.BadRequestException('expires_at_invalid');
        if (effectiveFrom && expiresAt && expiresAt.getTime() < effectiveFrom.getTime()) {
            throw new common_1.BadRequestException('expires_before_effective');
        }
        return { effectiveFrom, expiresAt };
    }
    async notifyVerifiers(companyId, applicationId, policyNumber) {
        const targets = await this.prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { role: client_1.UserRole.credit_officer, creditScope: 'all' },
                    { role: client_1.UserRole.credit_officer, creditCompanies: { some: { companyId } } },
                    { role: client_1.UserRole.finance_officer, financeScope: 'all' },
                    { role: client_1.UserRole.finance_officer, financeCompanies: { some: { companyId } } },
                    { role: { in: [client_1.UserRole.admin, client_1.UserRole.super_admin] } },
                ],
            },
            select: { id: true },
        });
        for (const target of targets) {
            await this.activity.notify(target.id, 'Takaful policy awaiting verification', `A customer uploaded takaful policy${policyNumber ? ` ${policyNumber}` : ''} for verification.`, `/applications/${applicationId}`);
        }
    }
};
exports.TakafulService = TakafulService;
exports.TakafulService = TakafulService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        activity_service_1.ActivityService])
], TakafulService);
//# sourceMappingURL=takaful.service.js.map