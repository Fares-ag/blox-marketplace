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
exports.ApplicationIntakeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const activity_service_1 = require("../common/activity.service");
const encryption_service_1 = require("../common/encryption.service");
const identity_service_1 = require("../common/identity.service");
const prisma_service_1 = require("../prisma/prisma.service");
const application_dedup_1 = require("./application-dedup");
const application_rules_1 = require("./application-rules");
const customer_snapshot_1 = require("./customer-snapshot");
let ApplicationIntakeService = class ApplicationIntakeService {
    prisma;
    activity;
    encryption;
    identity;
    config;
    constructor(prisma, activity, encryption, identity, config) {
        this.prisma = prisma;
        this.activity = activity;
        this.encryption = encryption;
        this.identity = identity;
        this.config = config;
    }
    ruleEnforcement() {
        return (0, application_rules_1.productRuleEnforcementFrom)((key) => this.config.get(key));
    }
    qidHash(qid) {
        return this.encryption.qidHash(qid);
    }
    async evaluateIdentity(input) {
        const qidHash = this.encryption.qidHash(input.qid);
        if (!qidHash)
            return null;
        const digits = String(input.qid ?? '').replace(/\D/g, '');
        const [users, applications] = await Promise.all([
            this.prisma.user.findMany({
                where: {
                    id: { not: input.userId },
                    OR: [{ qidHash }, ...(digits ? [{ qid: digits }] : [])],
                },
                select: { id: true, name: true, firstName: true, lastName: true, dateOfBirth: true },
                take: 25,
            }),
            this.prisma.application.findMany({
                where: { qidHash, customerUserId: { not: input.userId } },
                select: { customerUserId: true, customerSnapshot: true },
                orderBy: { createdAt: 'desc' },
                take: 25,
            }),
        ]);
        const matches = [
            ...users.map((u) => ({
                userId: u.id,
                name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' '),
                birthYear: u.dateOfBirth ? u.dateOfBirth.getUTCFullYear() : null,
                source: 'user',
            })),
            ...applications.map((a) => {
                const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(a.customerSnapshot);
                return {
                    userId: a.customerUserId,
                    name: snapshot.full_name,
                    birthYear: (0, customer_snapshot_1.birthYearOf)(snapshot),
                    source: 'application',
                };
            }),
        ];
        return (0, application_dedup_1.decideIdentityHold)({ userId: input.userId, name: input.name, birthYear: input.birthYear }, matches);
    }
    holdColumns(decision, now = new Date()) {
        if (!decision)
            return {};
        return {
            identityHoldReason: decision.reason,
            identityHoldAt: now,
            identityHoldClearedAt: null,
            identityHoldClearedById: null,
        };
    }
    async recordHold(input) {
        await this.activity.log({
            actorUserId: input.actorUserId,
            entityType: 'application',
            entityId: input.applicationId,
            action: 'identity_hold',
            toValue: input.decision.reason,
            metadata: {
                reason: input.decision.reason,
                conflicts: input.decision.conflicts.map((c) => ({
                    user_id: c.userId,
                    source: c.source,
                    name_mismatch: c.nameMismatch,
                    birth_year_mismatch: c.birthYearMismatch,
                })),
            },
        });
        await this.notifyOps(input.companyId, [client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin], 'Identity hold on an application', 'The Qatar ID on a new application is already on file under a different name or date of birth. Review and clear the hold.', `/applications/${input.applicationId}`);
    }
    async guarantorConsentCompleted(applicationId) {
        const session = await this.prisma.guarantorConsentSession.findFirst({
            where: {
                applicationId,
                consentsCompletedAt: { not: null },
                status: { not: client_1.GuarantorSessionStatus.cancelled },
            },
            select: { id: true },
        });
        return !!session;
    }
    async defaultLenderId() {
        const partner = await this.prisma.financePartner.findFirst({
            where: { isDefaultLender: true, active: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });
        return partner?.id ?? null;
    }
    userProfileData(user, normalized) {
        const keptQid = this.identity.readQid(user) || normalized.snapshot.qid || null;
        const profile = normalized.profile;
        const data = {
            name: user.name || normalized.snapshot.full_name,
            phone: user.phone || normalized.snapshot.phone,
            ...(this.identity.prepareQidWrite(keptQid) ?? {}),
        };
        if (profile.firstName)
            data.firstName = profile.firstName;
        if (profile.lastName)
            data.lastName = profile.lastName;
        if (profile.gender)
            data.gender = profile.gender;
        if (profile.dateOfBirth)
            data.dateOfBirth = profile.dateOfBirth;
        if (profile.nationality)
            data.nationality = profile.nationality;
        return data;
    }
    async notifyOps(companyId, roles, title, body, linkPath) {
        const or = [];
        if (roles.includes(client_1.UserRole.credit_officer)) {
            or.push({ role: client_1.UserRole.credit_officer, creditScope: 'all' });
            or.push({ role: client_1.UserRole.credit_officer, creditCompanies: { some: { companyId } } });
        }
        if (roles.includes(client_1.UserRole.finance_officer)) {
            or.push({ role: client_1.UserRole.finance_officer, financeScope: 'all' });
            or.push({ role: client_1.UserRole.finance_officer, financeCompanies: { some: { companyId } } });
        }
        if (roles.includes(client_1.UserRole.dealer_agent)) {
            or.push({ role: client_1.UserRole.dealer_agent, companyId });
        }
        const adminRoles = roles.filter((r) => r === client_1.UserRole.admin || r === client_1.UserRole.super_admin);
        if (adminRoles.length)
            or.push({ role: { in: adminRoles } });
        if (or.length === 0)
            return;
        const targets = await this.prisma.user.findMany({
            where: { isActive: true, OR: or },
            select: { id: true, role: true },
        });
        for (const target of targets) {
            await this.activity.notify(target.id, typeof title === 'function' ? title(target.role) : title, body, linkPath);
        }
    }
};
exports.ApplicationIntakeService = ApplicationIntakeService;
exports.ApplicationIntakeService = ApplicationIntakeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        encryption_service_1.EncryptionService,
        identity_service_1.IdentityService,
        config_1.ConfigService])
], ApplicationIntakeService);
//# sourceMappingURL=application-intake.service.js.map