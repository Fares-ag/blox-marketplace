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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const company_scope_1 = require("../applications/company-scope");
const compliance_provider_interface_1 = require("./compliance-provider.interface");
const compliance_response_dto_1 = require("./compliance-response.dto");
const compliance_gate_1 = require("./compliance-gate");
const OPS_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
function asJson(value) {
    return value;
}
let ComplianceService = class ComplianceService {
    prisma;
    activity;
    provider;
    constructor(prisma, activity, provider) {
        this.prisma = prisma;
        this.activity = activity;
        this.provider = provider;
    }
    assertOps(user) {
        if (!OPS_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    async findLatestPassingCheck(applicationId) {
        return this.prisma.complianceCheck.findFirst({
            where: { applicationId, overallStatus: client_1.ComplianceCheckStatus.pass },
            orderBy: { createdAt: 'desc' },
        });
    }
    async assertPassedForApproval(applicationId) {
        const check = await this.findLatestPassingCheck(applicationId);
        (0, compliance_gate_1.assertCompliancePassed)(check);
    }
    async runCheck(user, applicationId) {
        this.assertOps(user);
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: {
                id: true,
                companyId: true,
                customerSnapshot: true,
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        const snap = app.customerSnapshot;
        const qid = String(snap.qid ?? '').trim();
        const applicantName = String(snap.full_name ?? '').trim();
        const identity = await this.provider.verifyIdentity(qid, applicantName);
        const sanctions = await this.provider.screenSanctions(applicantName);
        const overallStatus = (0, compliance_gate_1.deriveOverallComplianceStatus)(identity.status, sanctions.status);
        const check = await this.prisma.complianceCheck.create({
            data: {
                applicationId,
                provider: this.provider.name,
                identityStatus: identity.status,
                sanctionsStatus: sanctions.status,
                overallStatus,
                identityResult: identity.raw ? asJson(identity.raw) : undefined,
                sanctionsResult: sanctions.raw ? asJson(sanctions.raw) : undefined,
                verifiedByUserId: user.id,
                qidScreened: qid,
                applicantName,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: applicationId,
            action: 'compliance_check',
            toValue: overallStatus,
            metadata: {
                provider: this.provider.name,
                identityStatus: identity.status,
                sanctionsStatus: sanctions.status,
            },
        });
        return (0, compliance_response_dto_1.toComplianceCheckDto)(check);
    }
};
exports.ComplianceService = ComplianceService;
exports.ComplianceService = ComplianceService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(compliance_provider_interface_1.COMPLIANCE_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService, Object])
], ComplianceService);
//# sourceMappingURL=compliance.service.js.map