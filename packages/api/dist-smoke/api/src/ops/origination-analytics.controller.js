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
exports.OriginationAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const company_hierarchy_1 = require("../companies/company-hierarchy");
const prisma_service_1 = require("../prisma/prisma.service");
const origination_funnel_1 = require("./origination-funnel");
class OriginationFunnelQueryDto {
    group_by;
    from;
    to;
    company_id;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(origination_funnel_1.ORIGINATION_FUNNEL_GROUPS),
    __metadata("design:type", String)
], OriginationFunnelQueryDto.prototype, "group_by", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OriginationFunnelQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OriginationFunnelQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OriginationFunnelQueryDto.prototype, "company_id", void 0);
function unique(values) {
    return [...new Set(values.filter((v) => !!v))];
}
let OriginationAnalyticsController = class OriginationAnalyticsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async originationFunnel(user, query) {
        const groupBy = query.group_by ?? 'company';
        const { from, to } = (0, origination_funnel_1.resolveFunnelRange)(query.from, query.to);
        const scopeIds = await this.resolveScope(user, query.company_id);
        const applications = await this.prisma.application.findMany({
            where: {
                ...(scopeIds ? { companyId: { in: scopeIds } } : {}),
                createdAt: { lte: to },
                updatedAt: { gte: from },
            },
            select: {
                id: true,
                companyId: true,
                branchId: true,
                agentUserId: true,
                status: true,
                createdAt: true,
                submittedAt: true,
                activatedAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: origination_funnel_1.FUNNEL_APPLICATION_CAP,
        });
        const appIds = applications.map((a) => a.id);
        const logs = appIds.length
            ? await this.prisma.activityLog.findMany({
                where: {
                    entityType: 'application',
                    action: 'status_transition',
                    entityId: { in: appIds },
                    toValue: { in: [...origination_funnel_1.APPROVAL_TARGET_STATUSES, client_1.ApplicationStatus.rejected] },
                },
                select: { entityId: true, fromValue: true, toValue: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            })
            : [];
        const companyIds = unique(applications.map((a) => a.companyId));
        const agentIds = unique(applications.map((a) => a.agentUserId));
        const [companies, agents] = await Promise.all([
            companyIds.length
                ? this.prisma.company.findMany({
                    where: { id: { in: companyIds } },
                    select: { id: true, name: true },
                })
                : [],
            agentIds.length
                ? this.prisma.user.findMany({
                    where: { id: { in: agentIds } },
                    select: { id: true, name: true, homeBranchId: true },
                })
                : [],
        ]);
        const branchIds = unique([
            ...applications.map((a) => a.branchId),
            ...agents.map((a) => a.homeBranchId),
        ]);
        const branches = branchIds.length
            ? await this.prisma.branch.findMany({
                where: { id: { in: branchIds } },
                select: { id: true, name: true, companyId: true },
            })
            : [];
        const labels = {
            companies: new Map(companies.map((c) => [c.id, { name: c.name }])),
            branches: new Map(branches.map((b) => [b.id, { name: b.name, companyId: b.companyId }])),
            agents: new Map(agents.map((a) => [a.id, { name: a.name, homeBranchId: a.homeBranchId }])),
        };
        return (0, origination_funnel_1.aggregateOriginationFunnel)({
            applications,
            transitions: logs.map((l) => ({
                applicationId: l.entityId,
                fromValue: l.fromValue,
                toValue: l.toValue,
                createdAt: l.createdAt,
            })),
            groupBy,
            from,
            to,
            labels,
        });
    }
    async resolveScope(user, companyId) {
        if (user.role === client_1.UserRole.dealer_agent) {
            return user.companyId ? [user.companyId] : [];
        }
        if (user.role === client_1.UserRole.group_admin) {
            const tree = user.companyId ? await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId) : [];
            if (!companyId)
                return tree;
            if (!tree.includes(companyId))
                throw new common_1.ForbiddenException('out_of_scope');
            return (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, companyId);
        }
        return companyId ? (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, companyId) : null;
    }
};
exports.OriginationAnalyticsController = OriginationAnalyticsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin, client_1.UserRole.dealer_agent),
    (0, common_1.Get)('origination-funnel'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, OriginationFunnelQueryDto]),
    __metadata("design:returntype", Promise)
], OriginationAnalyticsController.prototype, "originationFunnel", null);
exports.OriginationAnalyticsController = OriginationAnalyticsController = __decorate([
    (0, common_1.Controller)('ops/analytics'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OriginationAnalyticsController);
//# sourceMappingURL=origination-analytics.controller.js.map