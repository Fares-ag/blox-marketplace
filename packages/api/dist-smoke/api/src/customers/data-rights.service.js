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
exports.DataRightsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const activity_service_1 = require("../common/activity.service");
const identity_service_1 = require("../common/identity.service");
const consents_service_1 = require("../consents/consents.service");
const partner_logic_1 = require("../partner/partner-logic");
const prisma_service_1 = require("../prisma/prisma.service");
const customer_documents_service_1 = require("./customer-documents.service");
const customer_profile_1 = require("./customer-profile");
const data_rights_logic_1 = require("./data-rights-logic");
const REQUEST_INCLUDE = {
    handledBy: { select: { name: true } },
    user: { select: { id: true, name: true, email: true } },
};
const KIND_LABELS = {
    access: 'data access',
    correction: 'data correction',
    deletion: 'account deletion',
    consent_withdrawal: 'consent withdrawal',
};
let DataRightsService = class DataRightsService {
    prisma;
    activity;
    identity;
    consents;
    documents;
    constructor(prisma, activity, identity, consents, documents) {
        this.prisma = prisma;
        this.activity = activity;
        this.identity = identity;
        this.consents = consents;
        this.documents = documents;
    }
    async listMine(userId) {
        const rows = await this.prisma.dataRightsRequest.findMany({
            where: { userId },
            include: REQUEST_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => (0, data_rights_logic_1.toDataRightsRequestDto)(row));
    }
    async create(user, input) {
        const details = input.details?.trim() || null;
        let consentCode = null;
        if (input.kind === client_1.DataRightsRequestKind.consent_withdrawal) {
            const code = input.consent_code?.trim() ?? '';
            if (!(0, domain_rules_1.isConsentCode)(code))
                throw new common_1.BadRequestException({ message: 'consent_code_invalid', consent_code: code });
            consentCode = code;
        }
        if (input.kind === client_1.DataRightsRequestKind.deletion) {
            const active = await this.prisma.application.findFirst({
                where: { customerUserId: user.id, status: { in: data_rights_logic_1.DELETION_BLOCKING_STATUSES } },
                select: { id: true, status: true },
                orderBy: { updatedAt: 'desc' },
            });
            if (active) {
                throw new common_1.ConflictException({
                    message: 'deletion_blocked_active_financing',
                    application_id: active.id,
                    status: active.status,
                });
            }
        }
        const pending = await this.prisma.dataRightsRequest.findFirst({
            where: {
                userId: user.id,
                kind: input.kind,
                ...(consentCode ? { consentCode } : {}),
                status: { in: data_rights_logic_1.PENDING_DATA_RIGHTS_STATUSES },
            },
            select: { id: true },
        });
        if (pending)
            throw new common_1.ConflictException({ message: 'data_rights_request_pending', request_id: pending.id });
        const created = await this.prisma.dataRightsRequest.create({
            data: { userId: user.id, kind: input.kind, details, consentCode, dueAt: (0, data_rights_logic_1.dataRightsDueAt)() },
            include: REQUEST_INCLUDE,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'data_rights_request',
            entityId: created.id,
            action: 'data_rights_requested',
            toValue: input.kind,
            metadata: { consent_code: consentCode, due_at: created.dueAt?.toISOString() ?? null },
        });
        await this.notifyPrivacyTeam(created.id, input.kind, user.name);
        return (0, data_rights_logic_1.toDataRightsRequestDto)(created);
    }
    async exportFor(user) {
        const [applications, consents, documents, notifications, requests] = await Promise.all([
            this.prisma.application.findMany({
                where: { customerUserId: user.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    submittedAt: true,
                    activatedAt: true,
                    completedAt: true,
                    consentsCompletedAt: true,
                    customerSnapshot: true,
                    pricingSnapshot: true,
                    company: { select: { name: true } },
                    financePartner: { select: { name: true } },
                    product: { select: { make: true, model: true, modelYear: true } },
                },
            }),
            this.consents.statusFor(user.id),
            this.documents.list(user.id),
            this.prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 500 }),
            this.listMine(user.id),
        ]);
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'user',
            entityId: user.id,
            action: 'data_export_generated',
            metadata: { applications: applications.length, documents: documents.length },
        });
        return {
            generated_at: new Date().toISOString(),
            profile: {
                ...(0, customer_profile_1.toCustomerProfileDto)(user, this.identity.readQid(user)),
                qid: this.identity.readQid(user),
                email_verified: user.emailVerified,
                created_at: user.createdAt.toISOString(),
            },
            applications: applications.map((app) => ({
                id: app.id,
                status: app.status,
                created_at: app.createdAt.toISOString(),
                submitted_at: app.submittedAt?.toISOString() ?? null,
                activated_at: app.activatedAt?.toISOString() ?? null,
                completed_at: app.completedAt?.toISOString() ?? null,
                consents_completed_at: app.consentsCompletedAt?.toISOString() ?? null,
                company_name: app.company.name,
                finance_partner_name: app.financePartner?.name ?? null,
                vehicle: { make: app.product.make, model: app.product.model, model_year: app.product.modelYear },
                financing: (0, partner_logic_1.financingFromPricing)(app.pricingSnapshot),
                customer_snapshot: app.customerSnapshot,
            })),
            consents,
            documents,
            notifications: notifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body ?? null,
                link_path: n.linkPath ?? null,
                read_at: n.readAt?.toISOString() ?? null,
                created_at: n.createdAt.toISOString(),
            })),
            data_rights_requests: requests,
        };
    }
    async listForOps(status) {
        const rows = await this.prisma.dataRightsRequest.findMany({
            where: status ? { status } : {},
            include: REQUEST_INCLUDE,
            orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        });
        return rows.map((row) => (0, data_rights_logic_1.toDataRightsRequestDto)(row, { includeCustomer: true }));
    }
    async transition(actor, id, input) {
        const row = await this.prisma.dataRightsRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
        if (!row)
            throw new common_1.NotFoundException('data_rights_request_not_found');
        if (!(0, data_rights_logic_1.canTransitionDataRights)(row.status, input.status)) {
            throw new common_1.ConflictException({ message: 'invalid_status_transition', from: row.status, to: input.status });
        }
        const note = input.resolution_note?.trim() || null;
        const now = new Date();
        const terminal = (0, data_rights_logic_1.isTerminalDataRightsStatus)(input.status);
        const completing = input.status === client_1.DataRightsRequestStatus.completed;
        if (completing && row.kind === client_1.DataRightsRequestKind.consent_withdrawal && row.consentCode) {
            await this.consents.withdraw({
                userId: row.userId,
                code: row.consentCode,
                reason: note ?? row.details,
                actorUserId: actor.id,
                force: true,
            });
        }
        let anonymised = false;
        const updated = await this.prisma.$transaction(async (tx) => {
            if (completing && row.kind === client_1.DataRightsRequestKind.deletion) {
                await this.anonymiseUser(tx, row.userId, now);
                anonymised = true;
            }
            return tx.dataRightsRequest.update({
                where: { id: row.id },
                data: {
                    status: input.status,
                    resolutionNote: note ?? undefined,
                    handledById: actor.id,
                    handledAt: terminal ? now : row.handledAt,
                },
                include: REQUEST_INCLUDE,
            });
        });
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'data_rights_request',
            entityId: row.id,
            action: 'data_rights_transitioned',
            fromValue: row.status,
            toValue: input.status,
            metadata: { kind: row.kind, user_id: row.userId, consent_code: row.consentCode, note, anonymised },
        });
        if (anonymised) {
            await this.activity.log({
                actorUserId: actor.id,
                entityType: 'user',
                entityId: row.userId,
                action: 'user_anonymised',
                metadata: { data_rights_request_id: row.id },
            });
        }
        else {
            await this.notifyCustomer(row.userId, row.kind, input.status, note);
        }
        return (0, data_rights_logic_1.toDataRightsRequestDto)(updated, { includeCustomer: true });
    }
    async anonymiseUser(tx, userId, now) {
        const qid = this.identity.prepareQidWrite(null) ?? { qid: null, qidEnc: null, qidHash: null };
        await tx.user.update({
            where: { id: userId },
            data: {
                ...(0, data_rights_logic_1.anonymisationPatch)(userId),
                ...qid,
                address: client_1.Prisma.DbNull,
                notificationPreferences: client_1.Prisma.DbNull,
            },
        });
        await tx.customerDocument.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt: now } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.mobileRefreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.deviceToken.deleteMany({ where: { userId } });
    }
    async notifyPrivacyTeam(requestId, kind, customerName) {
        const admins = await this.prisma.user.findMany({
            where: { isActive: true, role: { in: [client_1.UserRole.admin, client_1.UserRole.super_admin] } },
            select: { id: true },
        });
        for (const admin of admins) {
            await this.activity.notify(admin.id, 'New data-rights request', `${customerName ?? 'A customer'} submitted a ${KIND_LABELS[kind]} request. Respond within ${data_rights_logic_1.DATA_RIGHTS_SLA_DAYS} days.`, `/data-rights/${requestId}`, { category: 'security' });
        }
    }
    async notifyCustomer(userId, kind, status, note) {
        const label = KIND_LABELS[kind];
        const copy = {
            in_progress: {
                title: 'Your data request is being handled',
                body: `Our privacy team is working on your ${label} request.`,
            },
            completed: {
                title: 'Your data request is complete',
                body: note ? `Your ${label} request has been completed. ${note}` : `Your ${label} request has been completed.`,
            },
            rejected: {
                title: 'Your data request could not be fulfilled',
                body: note ? `Your ${label} request was declined: ${note}` : `Your ${label} request was declined.`,
            },
        };
        const message = copy[status];
        if (!message)
            return;
        await this.activity.notify(userId, message.title, message.body, '/app/profile', { category: 'security' });
    }
};
exports.DataRightsService = DataRightsService;
exports.DataRightsService = DataRightsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        identity_service_1.IdentityService,
        consents_service_1.ConsentsService,
        customer_documents_service_1.CustomerDocumentsService])
], DataRightsService);
//# sourceMappingURL=data-rights.service.js.map