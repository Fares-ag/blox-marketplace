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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const application_access_1 = require("../applications/application-access");
const activity_service_1 = require("../common/activity.service");
const data_rights_logic_1 = require("../customers/data-rights-logic");
const prisma_service_1 = require("../prisma/prisma.service");
const consent_logic_1 = require("./consent-logic");
const consent_withdrawal_1 = require("./consent-withdrawal");
const CONSENT_STAMPABLE_STATUSES = [
    client_1.ApplicationStatus.draft,
    client_1.ApplicationStatus.resubmission_required,
];
let ConsentsService = class ConsentsService {
    prisma;
    activity;
    constructor(prisma, activity) {
        this.prisma = prisma;
        this.activity = activity;
    }
    async statusFor(userId, applicationId) {
        if (applicationId)
            await this.assertOwnedApplication(userId, applicationId);
        const status = (0, consent_logic_1.buildConsentStatus)(await this.loadRecords(userId));
        if (applicationId && status.complete)
            await this.stampApplication(userId, applicationId);
        return status;
    }
    async record(input) {
        const validation = (0, consent_logic_1.validateAcceptances)(input.acceptances);
        if (!validation.ok) {
            throw new common_1.BadRequestException({ message: validation.error, consent_code: validation.code });
        }
        if (!validation.accepted.length)
            throw new common_1.BadRequestException('validation_failed');
        const applicationId = input.applicationId ?? null;
        if (applicationId)
            await this.assertOwnedApplication(input.userId, applicationId);
        const locale = (0, consent_logic_1.normalizeConsentLocale)(input.locale);
        const acceptedAt = new Date();
        await this.prisma.consentRecord.createMany({
            data: validation.accepted.map(({ code, version }) => ({
                userId: input.userId,
                applicationId,
                code,
                version,
                textHash: (0, consent_logic_1.consentTextHash)(code, locale),
                locale,
                channel: input.channel,
                acceptedAt,
                ipAddress: input.ipAddress ?? null,
                userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
                sessionId: input.sessionId ?? null,
                deviceInfo: input.deviceInfo ?? undefined,
                actorUserId: input.actorUserId ?? null,
            })),
        });
        await this.activity.log({
            actorUserId: input.actorUserId ?? input.userId,
            entityType: applicationId ? 'application' : 'user',
            entityId: applicationId ?? input.userId,
            action: 'consents_recorded',
            toValue: domain_rules_1.CONSENT_CATALOG_VERSION,
            metadata: {
                user_id: input.userId,
                codes: validation.accepted.map((a) => a.code),
                channel: input.channel,
                locale,
            },
        });
        const status = (0, consent_logic_1.buildConsentStatus)(await this.loadRecords(input.userId));
        if (applicationId && status.complete)
            await this.stampApplication(input.userId, applicationId);
        return status;
    }
    async withdraw(input) {
        const code = String(input.code ?? '').trim();
        if (!(0, domain_rules_1.isConsentCode)(code)) {
            throw new common_1.BadRequestException({ message: 'consent_code_invalid', consent_code: code });
        }
        const reason = input.reason?.trim() || null;
        const live = await this.prisma.consentRecord.findMany({
            where: { userId: input.userId, code, withdrawnAt: null },
            select: { id: true },
        });
        if (!live.length && !input.force)
            throw new common_1.ConflictException('consent_not_accepted');
        const applications = await this.prisma.application.findMany({
            where: { customerUserId: input.userId, status: { in: application_access_1.BLOCKING_APPLICATION_STATUSES } },
            select: {
                id: true,
                status: true,
                consentsCompletedAt: true,
                consentRecords: { where: { code, withdrawnAt: null }, select: { id: true } },
            },
        });
        const decision = (0, consent_withdrawal_1.consentWithdrawalDecision)(code, applications.map((app) => ({
            id: app.id,
            status: app.status,
            consentsCompletedAt: app.consentsCompletedAt,
            consentCodes: app.consentRecords.length ? [code] : [],
        })));
        if (!decision.allowed && !input.force) {
            const request = await this.openWithdrawalRequest(input.userId, code, reason);
            throw new common_1.ConflictException({
                message: 'consent_withdrawal_blocked',
                consent_code: code,
                application_ids: decision.blockingApplicationIds,
                data_rights_request_id: request.id,
            });
        }
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            if (live.length) {
                await tx.consentRecord.updateMany({
                    where: { userId: input.userId, code, withdrawnAt: null },
                    data: { withdrawnAt: now, withdrawalReason: reason },
                });
            }
            if (decision.draftIdsToClear.length) {
                await tx.application.updateMany({
                    where: { id: { in: decision.draftIdsToClear }, customerUserId: input.userId },
                    data: { consentsCompletedAt: null },
                });
            }
        });
        await this.activity.log({
            actorUserId: input.actorUserId ?? input.userId,
            entityType: 'user',
            entityId: input.userId,
            action: 'consent_withdrawn',
            fromValue: code,
            metadata: {
                consent_code: code,
                records_withdrawn: live.length,
                drafts_cleared: decision.draftIdsToClear,
                live_applications: decision.blockingApplicationIds,
                forced: Boolean(input.force),
                reason,
            },
        });
        return (0, consent_logic_1.buildConsentStatus)(await this.loadRecords(input.userId));
    }
    async openWithdrawalRequest(userId, code, reason) {
        const pending = await this.prisma.dataRightsRequest.findFirst({
            where: {
                userId,
                kind: client_1.DataRightsRequestKind.consent_withdrawal,
                consentCode: code,
                status: { in: data_rights_logic_1.PENDING_DATA_RIGHTS_STATUSES },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (pending)
            return pending;
        const created = await this.prisma.dataRightsRequest.create({
            data: {
                userId,
                kind: client_1.DataRightsRequestKind.consent_withdrawal,
                consentCode: code,
                details: reason,
                dueAt: (0, data_rights_logic_1.dataRightsDueAt)(),
            },
        });
        await this.activity.log({
            actorUserId: userId,
            entityType: 'data_rights_request',
            entityId: created.id,
            action: 'data_rights_requested',
            toValue: client_1.DataRightsRequestKind.consent_withdrawal,
            metadata: { consent_code: code, origin: 'consent_withdrawal_blocked', due_at: created.dueAt?.toISOString() },
        });
        return created;
    }
    async statusForApplication(user, applicationId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: { id: true, customerUserId: true, companyId: true },
        });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        return (0, consent_logic_1.buildConsentStatus)(await this.loadRecords(app.customerUserId));
    }
    loadRecords(userId) {
        return this.prisma.consentRecord.findMany({
            where: { userId },
            include: { actor: { select: { name: true } } },
            orderBy: { acceptedAt: 'desc' },
        });
    }
    async assertOwnedApplication(userId, applicationId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: { id: true, customerUserId: true },
        });
        if (!app || app.customerUserId !== userId)
            throw new common_1.NotFoundException('application_not_found');
        return app;
    }
    async stampApplication(userId, applicationId) {
        const result = await this.prisma.application.updateMany({
            where: {
                id: applicationId,
                customerUserId: userId,
                consentsCompletedAt: null,
                status: { in: CONSENT_STAMPABLE_STATUSES },
            },
            data: { consentsCompletedAt: new Date() },
        });
        if (result.count > 0) {
            await this.activity.log({
                actorUserId: userId,
                entityType: 'application',
                entityId: applicationId,
                action: 'consents_completed',
                toValue: domain_rules_1.CONSENT_CATALOG_VERSION,
            });
        }
    }
};
exports.ConsentsService = ConsentsService;
exports.ConsentsService = ConsentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], ConsentsService);
//# sourceMappingURL=consents.service.js.map