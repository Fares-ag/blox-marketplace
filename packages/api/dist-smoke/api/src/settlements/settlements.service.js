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
exports.SettlementsService = exports.SETTLEMENT_QUOTE_OPS_ROLES = exports.SETTLEMENT_DECISION_ROLES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const application_access_1 = require("../applications/application-access");
const company_scope_1 = require("../applications/company-scope");
const settlement_quote_1 = require("./settlement-quote");
exports.SETTLEMENT_DECISION_ROLES = [
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
exports.SETTLEMENT_QUOTE_OPS_ROLES = [
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.credit_officer,
];
const APP_INCLUDE = {
    application: {
        select: {
            id: true,
            status: true,
            companyId: true,
            customer: { select: { name: true } },
            product: { select: { make: true, model: true, modelYear: true } },
            company: { select: { name: true } },
        },
    },
};
const QUOTE_SELECT = {
    id: true,
    status: true,
    customerUserId: true,
    customerEmail: true,
    companyId: true,
    pricingSnapshot: true,
    activatedAt: true,
    paymentSchedules: { orderBy: { sequence: 'asc' } },
};
function toDto(row) {
    return {
        id: row.id,
        application_id: row.applicationId,
        application_status: row.application.status,
        status: row.status,
        customer_email: row.customerEmail,
        customer_name: row.application.customer.name,
        vehicle: `${row.application.product.make} ${row.application.product.model} ${row.application.product.modelYear ?? ''}`.trim(),
        company_name: row.application.company.name,
        settlement_amount: Number(row.settlementAmount),
        remaining_principal: Number(row.remainingPrincipal),
        discount_amount: Number(row.discountAmount),
        forgiven_rent: Number(row.forgivenRent),
        accrued_profit: Number(row.accruedProfit),
        quote_as_of: row.quoteAsOf?.toISOString() ?? null,
        savings: (0, settlement_quote_1.settlementSavings)(row),
        requested_at: row.requestedAt.toISOString(),
        decided_at: row.decidedAt?.toISOString() ?? null,
        decision_reason: row.decisionReason,
    };
}
let SettlementsService = class SettlementsService {
    prisma;
    activity;
    constructor(prisma, activity) {
        this.prisma = prisma;
        this.activity = activity;
    }
    assertDecisionRole(user) {
        if (!exports.SETTLEMENT_DECISION_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    async loadForQuote(user, applicationId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: QUOTE_SELECT,
        });
        if (!app)
            throw new common_1.NotFoundException();
        if (user.role === client_1.UserRole.customer) {
            if (app.customerUserId !== user.id)
                throw new common_1.NotFoundException();
        }
        else {
            if (!exports.SETTLEMENT_QUOTE_OPS_ROLES.includes(user.role))
                throw new common_1.ForbiddenException('forbidden_role');
            await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        }
        if (app.status !== client_1.ApplicationStatus.active) {
            throw new common_1.BadRequestException('settlement_requires_active_financing');
        }
        return app;
    }
    async quote(user, applicationId) {
        const app = await this.loadForQuote(user, applicationId);
        return (0, settlement_quote_1.toSettlementQuoteDto)((0, settlement_quote_1.quoteForApplication)(app));
    }
    async request(user, applicationId) {
        if (user.role !== client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.loadForQuote(user, applicationId);
        const open = await this.prisma.applicationSettlement.findFirst({
            where: { applicationId, status: client_1.SettlementStatus.pending },
        });
        if (open)
            throw new common_1.BadRequestException('settlement_already_requested');
        const quote = (0, settlement_quote_1.quoteForApplication)(app);
        if (quote.settlementAmount <= 0)
            throw new common_1.BadRequestException('nothing_to_settle');
        const values = (0, settlement_quote_1.settlementRequestValues)(quote);
        const row = await this.prisma.applicationSettlement.create({
            data: {
                applicationId,
                customerUserId: user.id,
                customerEmail: app.customerEmail,
                settlementAmount: values.settlementAmount,
                remainingPrincipal: values.remainingPrincipal,
                forgivenRent: values.forgivenRent,
                accruedProfit: values.accruedProfit,
                quoteAsOf: values.quoteAsOf,
            },
            include: APP_INCLUDE,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: applicationId,
            action: 'settlement_requested',
            toValue: 'pending',
            metadata: {
                settlement_id: row.id,
                amount: values.settlementAmount,
                principal_outstanding: values.remainingPrincipal,
                accrued_profit: values.accruedProfit,
                forgiven_rent: values.forgivenRent,
                overdue_amount: quote.overdueAmount,
                remaining_scheduled: quote.remainingScheduled,
                quote_as_of: quote.asOf,
            },
        });
        return toDto(row);
    }
    async list(user, query) {
        this.assertDecisionRole(user);
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
        const offset = Math.max(Number(query.offset) || 0, 0);
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
        };
        const [total, rows, pending] = await Promise.all([
            this.prisma.applicationSettlement.count({ where }),
            this.prisma.applicationSettlement.findMany({
                where,
                include: APP_INCLUDE,
                orderBy: { requestedAt: 'desc' },
                skip: offset,
                take: limit,
            }),
            this.prisma.applicationSettlement.count({
                where: { ...where, status: client_1.SettlementStatus.pending },
            }),
        ]);
        return { total, limit, offset, summary: { pending }, items: rows.map(toDto) };
    }
    async decide(user, id, decision, reason) {
        this.assertDecisionRole(user);
        const row = await this.prisma.applicationSettlement.findUnique({
            where: { id },
            include: APP_INCLUDE,
        });
        if (!row)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, row.application.companyId);
        if (row.status !== client_1.SettlementStatus.pending) {
            throw new common_1.BadRequestException('settlement_not_pending');
        }
        if (decision === 'rejected' && !reason?.trim()) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const updated = await this.prisma.applicationSettlement.update({
            where: { id },
            data: {
                status: decision,
                decidedAt: new Date(),
                decidedByUserId: user.id,
                decisionReason: reason?.trim() || null,
            },
            include: APP_INCLUDE,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: row.applicationId,
            action: `settlement_${decision}`,
            fromValue: 'pending',
            toValue: decision,
            metadata: { settlement_id: id, reason },
        });
        await this.activity.notify(row.customerUserId, decision === 'approved' ? 'Settlement approved' : 'Settlement request declined', reason, `/app/applications/${row.applicationId}`);
        return toDto(updated);
    }
};
exports.SettlementsService = SettlementsService;
exports.SettlementsService = SettlementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], SettlementsService);
//# sourceMappingURL=settlements.service.js.map