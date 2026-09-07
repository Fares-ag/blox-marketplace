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
exports.CustomerPaymentsService = void 0;
exports.hasActiveBloxMembership = hasActiveBloxMembership;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const credits_service_1 = require("../credits/credits.service");
const settlement_quote_1 = require("../settlements/settlement-quote");
const customer_payments_constants_1 = require("./customer-payments.constants");
const deferral_guard_1 = require("./deferral-guard");
function hasActiveBloxMembership(bloxMembership) {
    if (!bloxMembership || typeof bloxMembership !== 'object')
        return false;
    const m = bloxMembership;
    const active = m.isActive ?? m.is_active;
    return active === true;
}
function addOneCalendarMonth(date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    return new Date(Date.UTC(y, m + 1, d));
}
function formatDateOnly(date) {
    return date.toISOString().slice(0, 10);
}
let CustomerPaymentsService = class CustomerPaymentsService {
    prisma;
    credits;
    constructor(prisma, credits) {
        this.prisma = prisma;
        this.credits = credits;
    }
    async paymentsHub(user) {
        const schedules = await this.prisma.paymentSchedule.findMany({
            where: { application: { customerUserId: user.id } },
            include: {
                application: {
                    select: {
                        id: true,
                        status: true,
                        productId: true,
                        bloxMembership: true,
                        product: { select: { make: true, model: true, modelYear: true } },
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        });
        const credits = await this.credits.getBalance(user);
        const active = await this.prisma.application.findFirst({
            where: { customerUserId: user.id, status: client_1.ApplicationStatus.active },
            orderBy: { activatedAt: 'desc' },
            select: {
                id: true,
                pricingSnapshot: true,
                activatedAt: true,
                paymentSchedules: { orderBy: { sequence: 'asc' } },
            },
        });
        const settlementQuote = active && active.paymentSchedules.length > 0 ? (0, settlement_quote_1.toSettlementQuoteDto)((0, settlement_quote_1.quoteForApplication)(active)) : null;
        return {
            schedules,
            credits,
            settlement_application_id: settlementQuote ? active.id : null,
            settlement_quote: settlementQuote,
        };
    }
    async deferralStatus(user) {
        const year = new Date().getFullYear();
        const used = await this.prisma.paymentDeferral.count({
            where: { userId: user.id, year },
        });
        const activeApps = await this.prisma.application.findMany({
            where: { customerUserId: user.id, status: 'active' },
            select: { bloxMembership: true },
        });
        const membershipActive = activeApps.some((app) => hasActiveBloxMembership(app.bloxMembership));
        return {
            year,
            used,
            remaining: Math.max(customer_payments_constants_1.DEFERRALS_PER_CALENDAR_YEAR - used, 0),
            limit: customer_payments_constants_1.DEFERRALS_PER_CALENDAR_YEAR,
            membership_active: membershipActive,
        };
    }
    async deferPayment(user, applicationId, scheduleId, reason) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: {
                id: true,
                customerUserId: true,
                bloxMembership: true,
                installmentPlan: true,
            },
        });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        if (app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (!hasActiveBloxMembership(app.bloxMembership)) {
            throw new common_1.BadRequestException('membership_required');
        }
        const quota = await this.deferralStatus(user);
        if (quota.remaining <= 0) {
            throw new common_1.BadRequestException('deferral_quota_exhausted');
        }
        const schedule = await this.prisma.paymentSchedule.findFirst({
            where: { id: scheduleId, applicationId },
        });
        if (!schedule)
            throw new common_1.NotFoundException('schedule_not_found');
        (0, deferral_guard_1.assertScheduleDeferrable)(schedule, new Date());
        const originalDueDate = schedule.dueDate;
        const deferredToDate = addOneCalendarMonth(originalDueDate);
        const year = new Date().getFullYear();
        const amount = Number(schedule.remainingAmount);
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.paymentDeferral.create({
                data: {
                    applicationId,
                    userId: user.id,
                    paymentId: scheduleId,
                    originalDueDate,
                    deferredToDate,
                    reason: reason?.trim() || null,
                    year,
                    deferredAmount: amount,
                    originalAmount: Number(schedule.amount),
                },
            });
            const row = await tx.paymentSchedule.update({
                where: { id: scheduleId },
                data: { dueDate: deferredToDate },
            });
            const planRaw = app.installmentPlan;
            if (planRaw && typeof planRaw === 'object') {
                const plan = planRaw;
                const origKey = formatDateOnly(originalDueDate);
                const updatedSchedule = (plan.schedule ?? []).map((entry) => {
                    const entryDue = entry.dueDate?.split('T')[0];
                    const matches = entryDue === origKey ||
                        (entry.sequence != null && entry.sequence === schedule.sequence);
                    if (!matches)
                        return entry;
                    return {
                        ...entry,
                        dueDate: formatDateOnly(deferredToDate),
                        isDeferred: true,
                        originalDueDate: entry.originalDueDate ?? origKey,
                    };
                });
                await tx.application.update({
                    where: { id: applicationId },
                    data: {
                        installmentPlan: {
                            ...plan,
                            schedule: updatedSchedule,
                        },
                    },
                });
            }
            return row;
        });
        return {
            schedule: {
                id: updated.id,
                application_id: updated.applicationId,
                sequence: updated.sequence,
                due_date: formatDateOnly(updated.dueDate),
                amount: Number(updated.amount),
                remaining_amount: Number(updated.remainingAmount),
                status: updated.status,
            },
            deferral_status: await this.deferralStatus(user),
        };
    }
};
exports.CustomerPaymentsService = CustomerPaymentsService;
exports.CustomerPaymentsService = CustomerPaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        credits_service_1.CreditsService])
], CustomerPaymentsService);
//# sourceMappingURL=customer-payments.service.js.map