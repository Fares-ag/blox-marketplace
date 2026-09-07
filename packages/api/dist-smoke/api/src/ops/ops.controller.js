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
var OpsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const company_scope_1 = require("../applications/company-scope");
const pagination_dto_1 = require("../common/pagination.dto");
const seed_finance_partners_1 = require("../../prisma/seed-finance-partners");
const seed_branches_1 = require("../../prisma/seed-branches");
const seed_chery_1 = require("../../prisma/seed-chery");
const seed_qauto_inventory_1 = require("../../prisma/seed-qauto-inventory");
const upload_qauto_listing_images_1 = require("../../prisma/upload-qauto-listing-images");
const backfill_listing_image_urls_1 = require("../../prisma/backfill-listing-image-urls");
const bootstrap_qauto_1 = require("../../prisma/bootstrap-qauto");
const backfill_installment_plan_1 = require("../applications/backfill-installment-plan");
const company_hierarchy_1 = require("../companies/company-hierarchy");
const prisma_service_1 = require("../prisma/prisma.service");
const vehicle_identity_1 = require("../products/vehicle-identity");
const ops_metrics_helpers_1 = require("./ops-metrics.helpers");
class ActivityLogsQueryDto extends pagination_dto_1.PaginationQueryDto {
    entityType;
    actorEmail;
    from;
    to;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ActivityLogsQueryDto.prototype, "entityType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ActivityLogsQueryDto.prototype, "actorEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ActivityLogsQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ActivityLogsQueryDto.prototype, "to", void 0);
let OpsController = class OpsController {
    static { OpsController_1 = this; }
    prisma;
    static EXPECTED_CRM_SYNC_STATUSES = [
        client_1.ApplicationStatus.under_review,
        client_1.ApplicationStatus.resubmission_required,
        client_1.ApplicationStatus.contract_signing_required,
        client_1.ApplicationStatus.contracts_submitted,
        client_1.ApplicationStatus.contract_under_review,
        client_1.ApplicationStatus.down_payment_required,
        client_1.ApplicationStatus.down_payment_submitted,
        client_1.ApplicationStatus.pending_finance_activation,
        client_1.ApplicationStatus.active,
        client_1.ApplicationStatus.partner_processing,
    ];
    constructor(prisma) {
        this.prisma = prisma;
    }
    async metrics(user, companyId) {
        let scopedIds = null;
        if (user.role === client_1.UserRole.group_admin) {
            if (!user.companyId)
                scopedIds = [];
            else
                scopedIds = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId);
        }
        else if (companyId) {
            scopedIds = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, companyId);
        }
        const appWhere = scopedIds ? { companyId: { in: scopedIds } } : {};
        const productWhere = scopedIds
            ? { listingStatus: 'published', companyId: { in: scopedIds } }
            : { listingStatus: 'published' };
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const [users, customers, companies, publishedProducts, applicationsByStatus, schedulesPending, schedulesOverdue, applicationsThisMonth, newCustomers30d, recentApplications, recentUsers, recentActivity,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { role: client_1.UserRole.customer } }),
            this.prisma.company.count({
                where: { status: 'active', ...(scopedIds ? { id: { in: scopedIds } } : {}) },
            }),
            this.prisma.product.count({ where: productWhere }),
            this.prisma.application.groupBy({ by: ['status'], where: appWhere, _count: { _all: true } }),
            this.prisma.paymentSchedule.count({
                where: { status: 'pending', ...(scopedIds ? { application: { companyId: { in: scopedIds } } } : {}) },
            }),
            this.prisma.paymentSchedule.count({
                where: { status: 'overdue', ...(scopedIds ? { application: { companyId: { in: scopedIds } } } : {}) },
            }),
            this.prisma.application.count({ where: { createdAt: { gte: monthStart }, ...appWhere } }),
            this.prisma.user.count({
                where: { role: client_1.UserRole.customer, createdAt: { gte: thirtyDaysAgo } },
            }),
            this.prisma.application.findMany({
                where: { createdAt: { gte: (0, ops_metrics_helpers_1.weekBuckets)(12)[0]?.start ?? monthStart }, ...appWhere },
                select: { createdAt: true, companyId: true },
            }),
            this.prisma.user.findMany({
                where: { createdAt: { gte: (0, ops_metrics_helpers_1.weekBuckets)(12)[0]?.start ?? monthStart } },
                select: { createdAt: true },
            }),
            this.prisma.activityLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { actor: { select: { email: true } } },
            }),
        ]);
        const topDealerGroups = await this.prisma.application.groupBy({
            by: ['companyId'],
            where: appWhere,
            _count: { _all: true },
            orderBy: { _count: { companyId: 'desc' } },
            take: 5,
        });
        const companyIds = topDealerGroups.map((g) => g.companyId);
        const companyNames = companyIds.length
            ? await this.prisma.company.findMany({
                where: { id: { in: companyIds } },
                select: { id: true, name: true },
            })
            : [];
        const nameById = Object.fromEntries(companyNames.map((c) => [c.id, c.name]));
        const submissionWeeks = (0, ops_metrics_helpers_1.weekBuckets)(12);
        const submissions_by_week = submissionWeeks.map((w) => ({
            label: w.label,
            count: (0, ops_metrics_helpers_1.countInRange)(recentApplications, w.start, w.end),
        }));
        const growthWeeks = (0, ops_metrics_helpers_1.weekBuckets)(12);
        const platform_growth = growthWeeks.map((w) => ({
            label: w.label,
            users: (0, ops_metrics_helpers_1.countInRange)(recentUsers, w.start, w.end),
            applications: (0, ops_metrics_helpers_1.countInRange)(recentApplications, w.start, w.end),
        }));
        return {
            users_total: users,
            customers_total: customers,
            companies_active: companies,
            products_published: publishedProducts,
            applications_by_status: Object.fromEntries(applicationsByStatus.map((row) => [row.status, row._count._all])),
            schedules_pending: schedulesPending,
            schedules_overdue: schedulesOverdue,
            applications_this_month: applicationsThisMonth,
            new_customers_30d: newCustomers30d,
            top_dealers_by_apps: topDealerGroups.map((g) => ({
                company_id: g.companyId,
                company_name: nameById[g.companyId] ?? g.companyId,
                count: g._count._all,
            })),
            submissions_by_week,
            platform_growth,
            recent_activity: recentActivity.map((l) => ({
                id: l.id,
                action: l.action,
                entity_type: l.entityType,
                actor_email: l.actor?.email ?? null,
                created_at: l.createdAt.toISOString(),
            })),
            funnel: {
                draft: applicationsByStatus.find((r) => r.status === 'draft')?._count._all ?? 0,
                under_review: applicationsByStatus.find((r) => r.status === 'under_review')?._count._all ?? 0,
                active: applicationsByStatus.find((r) => r.status === 'active')?._count._all ?? 0,
                completed: applicationsByStatus.find((r) => r.status === 'completed')?._count._all ?? 0,
                rejected: applicationsByStatus.find((r) => r.status === 'rejected')?._count._all ?? 0,
            },
            conversion_rate: (applicationsByStatus.find((r) => r.status === 'completed')?._count._all ?? 0) /
                Math.max(1, applicationsByStatus.reduce((sum, row) => sum + row._count._all, 0)),
        };
    }
    dashboardStats(user, companyId) {
        return this.metrics(user, companyId);
    }
    async revenueForecast() {
        const apps = await this.prisma.application.findMany({
            where: { status: { in: ['active', 'completed'] } },
            select: { pricingSnapshot: true, paymentSchedules: { select: { amount: true, status: true } } },
            take: 500,
        });
        let projected = 0;
        let collected = 0;
        for (const app of apps) {
            const pricing = app.pricingSnapshot ?? {};
            projected += Number(pricing.financed_total ?? 0);
            for (const s of app.paymentSchedules) {
                if (s.status === 'paid')
                    collected += Number(s.amount);
            }
        }
        return { projected_revenue: Math.round(projected), real_revenue: Math.round(collected) };
    }
    async conversionFunnel() {
        const rows = await this.prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
        const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
        return {
            draft: byStatus.draft ?? 0,
            under_review: byStatus.under_review ?? 0,
            contract: (byStatus.contract_signing_required ?? 0) + (byStatus.contracts_submitted ?? 0),
            active: byStatus.active ?? 0,
            completed: byStatus.completed ?? 0,
            rejected: byStatus.rejected ?? 0,
        };
    }
    async paymentCollectionRates() {
        const [paid, pending, overdue] = await Promise.all([
            this.prisma.paymentSchedule.count({ where: { status: 'paid' } }),
            this.prisma.paymentSchedule.count({ where: { status: 'pending' } }),
            this.prisma.paymentSchedule.count({ where: { status: 'overdue' } }),
        ]);
        const total = paid + pending + overdue;
        return {
            paid,
            pending,
            overdue,
            collection_rate: total ? paid / total : 0,
        };
    }
    async customerLifetimeValue() {
        const rows = await this.prisma.application.groupBy({
            by: ['customerUserId'],
            _count: { _all: true },
            orderBy: { _count: { customerUserId: 'desc' } },
            take: 10,
        });
        const customerIds = rows.map((r) => r.customerUserId);
        const customers = customerIds.length
            ? await this.prisma.user.findMany({
                where: { id: { in: customerIds } },
                select: { id: true, name: true, email: true },
            })
            : [];
        const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
        const apps = await this.prisma.application.findMany({
            where: { customerUserId: { in: customerIds } },
            select: { customerUserId: true, pricingSnapshot: true },
        });
        const valueByCustomer = new Map();
        for (const app of apps) {
            const pricing = app.pricingSnapshot ?? {};
            valueByCustomer.set(app.customerUserId, (valueByCustomer.get(app.customerUserId) ?? 0) + Number(pricing.financed_total ?? pricing.list_price ?? 0));
        }
        return {
            top_customers: rows.map((r) => ({
                customer_id: r.customerUserId,
                name: byId[r.customerUserId]?.name ?? null,
                email: byId[r.customerUserId]?.email ?? null,
                applications: r._count._all,
                lifetime_value: Math.round(valueByCustomer.get(r.customerUserId) ?? 0),
            })),
        };
    }
    async dealerMetrics(user) {
        if (!user.companyId) {
            return {
                inventory: { draft: 0, published: 0, reserved: 0, sold: 0 },
                applications_by_status: {},
                quotes_active: 0,
                quotes_expired: 0,
                submissions_this_month: 0,
                submissions_by_week: (0, ops_metrics_helpers_1.weekBuckets)(8).map((w) => ({ label: w.label, count: 0 })),
                open_applications: 0,
            };
        }
        const companyId = user.companyId;
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const now = new Date();
        const [products, appsByStatus, quotes, monthApps, weekApps] = await Promise.all([
            this.prisma.product.findMany({
                where: { companyId },
                select: { listingStatus: true },
            }),
            this.prisma.application.groupBy({
                by: ['status'],
                where: { companyId },
                _count: { _all: true },
            }),
            this.prisma.dealerQuote.findMany({
                where: { companyId },
                select: { expiresAt: true, revokedAt: true, usedAt: true },
            }),
            this.prisma.application.count({
                where: { companyId, createdAt: { gte: monthStart } },
            }),
            this.prisma.application.findMany({
                where: { companyId, createdAt: { gte: (0, ops_metrics_helpers_1.weekBuckets)(8)[0]?.start ?? monthStart } },
                select: { createdAt: true },
            }),
        ]);
        const inventory = {
            draft: products.filter((p) => p.listingStatus === 'draft').length,
            published: products.filter((p) => p.listingStatus === 'published').length,
            reserved: products.filter((p) => p.listingStatus === 'reserved').length,
            sold: products.filter((p) => p.listingStatus === 'sold').length,
        };
        const applications_by_status = Object.fromEntries(appsByStatus.map((r) => [r.status, r._count._all]));
        const openStatuses = [
            client_1.ApplicationStatus.draft,
            client_1.ApplicationStatus.under_review,
            client_1.ApplicationStatus.resubmission_required,
            client_1.ApplicationStatus.contract_signing_required,
            client_1.ApplicationStatus.contracts_submitted,
            client_1.ApplicationStatus.contract_under_review,
        ];
        const open_applications = appsByStatus
            .filter((r) => openStatuses.includes(r.status))
            .reduce((sum, r) => sum + r._count._all, 0);
        let quotes_active = 0;
        let quotes_expired = 0;
        for (const q of quotes) {
            if (q.usedAt || q.revokedAt)
                continue;
            if (q.expiresAt < now)
                quotes_expired += 1;
            else
                quotes_active += 1;
        }
        return {
            inventory,
            applications_by_status,
            quotes_active,
            quotes_expired,
            submissions_this_month: monthApps,
            submissions_by_week: (0, ops_metrics_helpers_1.weekBuckets)(8).map((w) => ({
                label: w.label,
                count: (0, ops_metrics_helpers_1.countInRange)(weekApps, w.start, w.end),
            })),
            open_applications,
        };
    }
    async creditMetrics(user) {
        const companyIds = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const companyWhere = companyIds ? { companyId: { in: companyIds } } : {};
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const reviewStatuses = [
            client_1.ApplicationStatus.under_review,
            client_1.ApplicationStatus.resubmission_required,
            client_1.ApplicationStatus.contracts_submitted,
            client_1.ApplicationStatus.contract_under_review,
        ];
        const [appsByStatus, resubmissions, approvedToday, rejected30d, zohoFailures, queueApps, weekApps,] = await Promise.all([
            this.prisma.application.groupBy({
                by: ['status'],
                where: companyWhere,
                _count: { _all: true },
            }),
            this.prisma.application.count({
                where: { ...companyWhere, status: client_1.ApplicationStatus.resubmission_required },
            }),
            this.prisma.activityLog.count({
                where: {
                    action: { in: ['approve', 'application_approved', 'credit_approved'] },
                    createdAt: { gte: todayStart },
                },
            }),
            this.prisma.application.count({
                where: { ...companyWhere, status: client_1.ApplicationStatus.rejected, updatedAt: { gte: thirtyDaysAgo } },
            }),
            this.prisma.application.count({
                where: {
                    ...companyWhere,
                    OR: [{ zohoSyncError: { not: null } }, { zohoLeadId: null, status: { in: OpsController_1.EXPECTED_CRM_SYNC_STATUSES } }],
                },
            }),
            this.prisma.application.findMany({
                where: { ...companyWhere, status: { in: reviewStatuses } },
                orderBy: { updatedAt: 'asc' },
                take: 5,
                select: { id: true, customerEmail: true, status: true, updatedAt: true },
            }),
            this.prisma.application.findMany({
                where: { ...companyWhere, createdAt: { gte: (0, ops_metrics_helpers_1.weekBuckets)(8)[0]?.start ?? thirtyDaysAgo } },
                select: { createdAt: true },
            }),
        ]);
        const in_review = (appsByStatus.find((r) => r.status === client_1.ApplicationStatus.under_review)?._count._all ?? 0) +
            (appsByStatus.find((r) => r.status === client_1.ApplicationStatus.contract_under_review)?._count._all ?? 0);
        return {
            in_review,
            resubmissions_pending: resubmissions,
            approved_today: approvedToday,
            rejected_30d: rejected30d,
            zoho_failures: zohoFailures,
            queue_by_status: Object.fromEntries(appsByStatus.map((r) => [r.status, r._count._all])),
            priority_queue: queueApps.map((a) => ({
                id: a.id,
                customer_email: a.customerEmail,
                status: a.status,
                updated_at: a.updatedAt.toISOString(),
            })),
            review_volume_by_week: (0, ops_metrics_helpers_1.weekBuckets)(8).map((w) => ({
                label: w.label,
                count: (0, ops_metrics_helpers_1.countInRange)(weekApps, w.start, w.end),
            })),
        };
    }
    async financeMetrics(user) {
        const companyIds = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const appWhere = companyIds ? { companyId: { in: companyIds } } : {};
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const weekFromNow = new Date(Date.now() + 7 * 86400000);
        const appIds = companyIds
            ? (await this.prisma.application.findMany({
                where: appWhere,
                select: { id: true },
            })).map((a) => a.id)
            : null;
        const scheduleWhere = appIds ? { applicationId: { in: appIds } } : {};
        const [pending, overdue, paid, pendingTransfers, activeFinancings, upcoming, paidEvents, overdueByWeek,] = await Promise.all([
            this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'pending' } }),
            this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'overdue' } }),
            this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'paid' } }),
            this.prisma.paymentTransaction.count({
                where: { gateway: 'bank_transfer', status: 'pending' },
            }),
            this.prisma.application.count({
                where: { ...appWhere, status: client_1.ApplicationStatus.active },
            }),
            this.prisma.paymentSchedule.findMany({
                where: {
                    ...scheduleWhere,
                    status: 'pending',
                    dueDate: { lte: weekFromNow, gte: new Date() },
                },
                orderBy: { dueDate: 'asc' },
                take: 5,
                select: {
                    id: true,
                    sequence: true,
                    dueDate: true,
                    amount: true,
                    applicationId: true,
                },
            }),
            this.prisma.paymentEvent.findMany({
                where: {
                    type: { in: ['installment', 'down_payment'] },
                    createdAt: { gte: (0, ops_metrics_helpers_1.weekBuckets)(8)[0]?.start ?? monthStart },
                },
                select: { createdAt: true, amount: true },
            }),
            this.prisma.paymentSchedule.findMany({
                where: { ...scheduleWhere, status: 'overdue' },
                select: { dueDate: true },
            }),
        ]);
        const collected_this_month = await this.prisma.paymentEvent.aggregate({
            where: {
                type: { in: ['installment', 'down_payment'] },
                createdAt: { gte: monthStart },
            },
            _sum: { amount: true },
        });
        return {
            schedules_pending: pending,
            schedules_overdue: overdue,
            schedules_paid: paid,
            pending_bank_transfers: pendingTransfers,
            active_financings: activeFinancings,
            collected_this_month: Number(collected_this_month._sum.amount ?? 0),
            schedule_status: { pending, overdue, paid },
            collections_by_week: (0, ops_metrics_helpers_1.weekBuckets)(8).map((w) => ({
                label: w.label,
                count: paidEvents.filter((e) => e.createdAt >= w.start && e.createdAt <= w.end).length,
                amount: paidEvents
                    .filter((e) => e.createdAt >= w.start && e.createdAt <= w.end)
                    .reduce((sum, e) => sum + Number(e.amount), 0),
            })),
            overdue_trend: (0, ops_metrics_helpers_1.weekBuckets)(8).map((w) => ({
                label: w.label,
                count: overdueByWeek.filter((s) => s.dueDate >= w.start && s.dueDate <= w.end).length,
            })),
            upcoming_due: upcoming.map((s) => ({
                id: s.id,
                application_id: s.applicationId,
                sequence: s.sequence,
                due_date: s.dueDate.toISOString().slice(0, 10),
                amount: Number(s.amount),
            })),
        };
    }
    async activityStats(range) {
        const now = new Date();
        let start;
        if (range === '7d')
            start = new Date(now.getTime() - 7 * 86400000);
        else if (range === '30d')
            start = new Date(now.getTime() - 30 * 86400000);
        else if (range === '90d')
            start = new Date(now.getTime() - 90 * 86400000);
        const where = start ? { createdAt: { gte: start } } : {};
        const logs = await this.prisma.activityLog.findMany({
            where,
            include: { actor: { select: { email: true } } },
        });
        const actionsByType = {};
        const actionsByResource = {};
        const userCounts = new Map();
        for (const log of logs) {
            actionsByType[log.action] = (actionsByType[log.action] ?? 0) + 1;
            actionsByResource[log.entityType] = (actionsByResource[log.entityType] ?? 0) + 1;
            const email = log.actor?.email ?? 'system';
            userCounts.set(email, (userCounts.get(email) ?? 0) + 1);
        }
        return {
            total_actions: logs.length,
            actions_by_type: actionsByType,
            actions_by_resource: actionsByResource,
            actions_by_user: [...userCounts.entries()]
                .map(([userEmail, count]) => ({ user_email: userEmail, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20),
        };
    }
    async activityLogs(query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const fromDate = query.from ? new Date(query.from) : undefined;
        const toDate = query.to ? new Date(query.to) : undefined;
        const hasFrom = fromDate && !Number.isNaN(fromDate.getTime());
        const hasTo = toDate && !Number.isNaN(toDate.getTime());
        const where = {
            ...(query.entityType ? { entityType: query.entityType } : {}),
            ...(query.actorEmail
                ? { actor: { email: { contains: query.actorEmail, mode: 'insensitive' } } }
                : {}),
            ...(hasFrom || hasTo
                ? {
                    createdAt: {
                        ...(hasFrom ? { gte: fromDate } : {}),
                        ...(hasTo ? { lte: toDate } : {}),
                    },
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.activityLog.findMany({
                where,
                include: { actor: { select: { email: true, name: true, role: true } } },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.activityLog.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((l) => ({
            id: l.id,
            actor_email: l.actor?.email ?? null,
            actor_role: l.actor?.role ?? null,
            entity_type: l.entityType,
            entity_id: l.entityId,
            action: l.action,
            from_value: l.fromValue,
            to_value: l.toValue,
            metadata: l.metadata,
            created_at: l.createdAt.toISOString(),
        })), total, limit, offset);
    }
    async products(query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                include: {
                    company: { select: { name: true, code: true } },
                    images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.product.count(),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((p) => ({
            id: p.id,
            slug: p.slug,
            make: p.make,
            model: p.model,
            model_year: p.modelYear,
            price: Number(p.price),
            listing_status: p.listingStatus,
            vin: p.vin,
            chassis_number: p.chassisNumber,
            engine_number: p.engineNumber,
            identity_complete: (0, vehicle_identity_1.vehicleIdentityComplete)(p),
            company_id: p.companyId,
            company_name: p.company.name,
            company_code: p.company.code,
            primary_image: p.images[0]?.storagePath ?? null,
            updated_at: p.updatedAt.toISOString(),
        })), total, limit, offset);
    }
    async zohoFailures(user, query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyIds = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const companyWhere = companyIds ? { companyId: { in: companyIds } } : {};
        const selection = {
            id: true,
            status: true,
            customerEmail: true,
            zohoLeadId: true,
            zohoSyncError: true,
            zohoSyncedAt: true,
            updatedAt: true,
            financePartner: { select: { name: true, code: true } },
        };
        const [failed, neverSynced] = await Promise.all([
            this.prisma.application.findMany({
                where: { zohoSyncError: { not: null }, ...companyWhere },
                select: selection,
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.application.findMany({
                where: {
                    zohoLeadId: null,
                    status: { in: OpsController_1.EXPECTED_CRM_SYNC_STATUSES },
                    financePartner: { crmAdapter: 'zoho' },
                    ...companyWhere,
                },
                select: selection,
                orderBy: { updatedAt: 'desc' },
            }),
        ]);
        const seen = new Set(failed.map((a) => a.id));
        const rows = [
            ...failed.map((a) => ({ row: a, reason: 'sync_error' })),
            ...neverSynced
                .filter((a) => !seen.has(a.id))
                .map((a) => ({ row: a, reason: 'never_synced' })),
        ].sort((a, b) => b.row.updatedAt.getTime() - a.row.updatedAt.getTime());
        const total = rows.length;
        const page = rows.slice(offset, offset + limit);
        return (0, pagination_dto_1.toPaginatedResponse)(page.map(({ row, reason }) => ({
            application_id: row.id,
            reason,
            status: row.status,
            customer_email: row.customerEmail,
            partner: row.financePartner?.name ?? null,
            zoho_lead_id: row.zohoLeadId,
            error: row.zohoSyncError,
            last_synced_at: row.zohoSyncedAt?.toISOString() ?? null,
            updated_at: row.updatedAt.toISOString(),
        })), total, limit, offset);
    }
    async searchCustomers(q, limitRaw) {
        const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
        const term = q?.trim();
        const users = await this.prisma.user.findMany({
            where: {
                role: client_1.UserRole.customer,
                ...(term
                    ? {
                        OR: [
                            { email: { contains: term, mode: 'insensitive' } },
                            { name: { contains: term, mode: 'insensitive' } },
                            { phone: { contains: term, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            select: { id: true, email: true, name: true, phone: true, qid: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const items = await Promise.all(users.map(async (user) => {
            const latest = await this.prisma.application.findFirst({
                where: { customerUserId: user.id },
                orderBy: { createdAt: 'desc' },
                select: { customerSnapshot: true },
            });
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                qid: user.qid,
                latest_snapshot: latest?.customerSnapshot ?? null,
            };
        }));
        return { items, total: items.length, limit, offset: 0 };
    }
    seedFinancePartners() {
        return (0, seed_finance_partners_1.seedFinancePartners)(this.prisma);
    }
    seedBranches() {
        return (0, seed_branches_1.seedBranches)(this.prisma);
    }
    async seedChery() {
        await (0, seed_finance_partners_1.seedFinancePartners)(this.prisma);
        return (0, seed_chery_1.seedCheryInventory)(this.prisma);
    }
    async seedQautoInventory() {
        await (0, seed_finance_partners_1.seedFinancePartners)(this.prisma);
        return (0, seed_qauto_inventory_1.seedQautoInventory)(this.prisma);
    }
    async uploadQautoListingImages() {
        return (0, upload_qauto_listing_images_1.uploadQautoListingImages)(this.prisma);
    }
    backfillListingImageUrls() {
        return (0, backfill_listing_image_urls_1.backfillListingImageUrls)(this.prisma);
    }
    backfillInstallmentPlan() {
        return (0, backfill_installment_plan_1.backfillInstallmentPlans)(this.prisma);
    }
    bootstrapQauto() {
        return (0, bootstrap_qauto_1.bootstrapQauto)(this.prisma);
    }
};
exports.OpsController = OpsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)('metrics'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('company_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "metrics", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)('dashboard-stats'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('company_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "dashboardStats", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('analytics/revenue-forecast'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "revenueForecast", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('analytics/conversion-funnel'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "conversionFunnel", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('analytics/payment-collection-rates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "paymentCollectionRates", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('analytics/customer-lifetime-value'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "customerLifetimeValue", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Get)('metrics/dealer'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "dealerMetrics", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('metrics/credit'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "creditMetrics", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('metrics/finance'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "financeMetrics", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('activity-stats'),
    __param(0, (0, common_1.Query)('range')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "activityStats", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('activity-logs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ActivityLogsQueryDto]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "activityLogs", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "products", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.credit_officer),
    (0, common_1.Get)('zoho/failures'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "zohoFailures", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.credit_officer, client_1.UserRole.finance_officer),
    (0, common_1.Get)('customers/search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "searchCustomers", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('seed-finance-partners'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "seedFinancePartners", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('seed-branches'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "seedBranches", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('seed-chery'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "seedChery", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('seed-qauto-inventory'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "seedQautoInventory", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('upload-qauto-listing-images'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "uploadQautoListingImages", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('backfill-listing-image-urls'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "backfillListingImageUrls", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('backfill-installment-plan'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "backfillInstallmentPlan", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.super_admin),
    (0, common_1.Post)('bootstrap-qauto'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OpsController.prototype, "bootstrapQauto", null);
exports.OpsController = OpsController = OpsController_1 = __decorate([
    (0, common_1.Controller)('ops'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OpsController);
//# sourceMappingURL=ops.controller.js.map