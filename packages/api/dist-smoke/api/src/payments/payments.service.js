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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const pricing_1 = require("@drivemarket/shared/pricing");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_errors_1 = require("../common/prisma-errors");
const pagination_dto_1 = require("../common/pagination.dto");
const app_config_service_1 = require("../config/app-config.service");
const activity_service_1 = require("../common/activity.service");
const analytics_service_1 = require("../analytics/analytics.service");
const system_actor_1 = require("../common/system-actor");
const company_scope_1 = require("../applications/company-scope");
const guarded_transitions_1 = require("../applications/guarded-transitions");
const separation_of_duties_1 = require("../applications/separation-of-duties");
const payment_ledger_1 = require("./payment-ledger");
const payment_response_dto_1 = require("./payment-response.dto");
const settle_all_guard_1 = require("./settle-all-guard");
const skipcash_client_1 = require("./skipcash.client");
const BLOX_CREDIT_QAR_VALUE = 250;
const PAYMENT_ROLES = [
    client_1.UserRole.finance_officer,
    client_1.UserRole.credit_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
const VIEW_ROLES = [
    client_1.UserRole.finance_officer,
    client_1.UserRole.credit_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
const WAIVE_ROLES = [client_1.UserRole.admin, client_1.UserRole.super_admin];
const DEFAULT_SKIPCASH_OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;
let PaymentsService = PaymentsService_1 = class PaymentsService {
    prisma;
    activity;
    analytics;
    config;
    appConfig;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(prisma, activity, analytics, config, appConfig) {
        this.prisma = prisma;
        this.activity = activity;
        this.analytics = analytics;
        this.config = config;
        this.appConfig = appConfig;
    }
    isSkipCashSandbox() {
        const flag = this.config.get('SKIPCASH_SANDBOX');
        return flag === 'true' || flag === '1';
    }
    skipCashClient() {
        return skipcash_client_1.SkipCashClient.fromEnv(process.env);
    }
    mobileSkipCashResponse(txn, opts) {
        const fallbackReturn = opts.applicationId
            ? `${this.appConfig.marketplacePath(`/app/applications/${opts.applicationId}`)}?skipcash_key=${encodeURIComponent(txn.idempotencyKey)}`
            : undefined;
        const paymentUrl = opts.paymentUrl ?? fallbackReturn ?? '';
        return {
            transaction_id: txn.id,
            idempotency_key: txn.idempotencyKey,
            amount: txn.amount.toNumber(),
            currency: 'QAR',
            redirect_url: paymentUrl,
            paymentUrl,
            payUrl: paymentUrl,
            paymentId: txn.gatewayPaymentId ?? undefined,
            sandbox: this.isSkipCashSandbox(),
        };
    }
    async attachSkipCashCheckout(txn, input) {
        const client = this.skipCashClient();
        if (client) {
            const created = await client.createPayment({
                amount: input.amount,
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                email: input.email,
                transactionId: input.transactionId,
                returnUrl: input.returnUrl,
                custom1: input.custom1,
                subject: input.subject,
                description: input.description,
                onlyDebitCard: input.onlyDebitCard,
            });
            const updated = await this.prisma.paymentTransaction.update({
                where: { id: txn.id },
                data: { gatewayPaymentId: created.id },
            });
            return this.mobileSkipCashResponse(updated, {
                paymentUrl: created.payUrl,
                applicationId: input.applicationId,
            });
        }
        if (this.isSkipCashSandbox() && input.returnUrl) {
            const url = new URL(input.returnUrl);
            url.searchParams.set('paymentId', txn.id);
            url.searchParams.set('transactionId', input.transactionId);
            url.searchParams.set('idempotency_key', txn.idempotencyKey);
            url.searchParams.set('sandbox', '1');
            return this.mobileSkipCashResponse(txn, {
                paymentUrl: url.toString(),
                applicationId: input.applicationId,
            });
        }
        return this.mobileSkipCashResponse(txn, { applicationId: input.applicationId });
    }
    assertWaiveRole(user) {
        if (!WAIVE_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    async resolveSodEnabled(companyId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { separationOfDutiesEnabled: true },
        });
        return (0, separation_of_duties_1.resolveSeparationOfDutiesEnabled)(this.config, company?.separationOfDutiesEnabled);
    }
    assertPaymentRole(user) {
        if (!PAYMENT_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    async listActiveBook(user, query) {
        if (!VIEW_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const q = query.q?.trim();
        const where = {
            status: 'active',
            ...(companyFilter ? { companyId: { in: companyFilter } } : {}),
            ...(q
                ? {
                    OR: [
                        { customerEmail: { contains: q, mode: 'insensitive' } },
                        { customer: { name: { contains: q, mode: 'insensitive' } } },
                        { product: { make: { contains: q, mode: 'insensitive' } } },
                        { product: { model: { contains: q, mode: 'insensitive' } } },
                    ],
                }
                : {}),
        };
        const today = startOfTodayUtc();
        const [total, apps] = await Promise.all([
            this.prisma.application.count({ where }),
            this.prisma.application.findMany({
                where,
                orderBy: { activatedAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    customer: { select: { name: true } },
                    product: { select: { make: true, model: true, modelYear: true } },
                    company: { select: { name: true } },
                    paymentSchedules: {
                        select: { dueDate: true, amount: true, remainingAmount: true, status: true, sequence: true },
                        orderBy: { dueDate: 'asc' },
                    },
                },
            }),
        ]);
        const items = apps.map((a) => {
            const schedules = a.paymentSchedules;
            const remaining = schedules.reduce((sum, s) => sum + Number(s.remainingAmount), 0);
            const paid = schedules.filter((s) => s.status === client_1.ScheduleStatus.paid).length;
            const overdue = schedules.filter((s) => s.status === client_1.ScheduleStatus.overdue || (s.status === client_1.ScheduleStatus.pending && s.dueDate < today)).length;
            const next = schedules.find((s) => s.status === client_1.ScheduleStatus.pending || s.status === client_1.ScheduleStatus.overdue);
            return {
                application_id: a.id,
                customer_name: a.customer?.name ?? null,
                customer_email: a.customerEmail,
                vehicle: `${a.product.make} ${a.product.model} ${a.product.modelYear ?? ''}`.trim(),
                company_name: a.company.name,
                activated_at: a.activatedAt?.toISOString() ?? null,
                remaining_principal: Math.round(remaining * 100) / 100,
                installments_total: schedules.length,
                installments_paid: paid,
                installments_overdue: overdue,
                next_due_date: next ? next.dueDate.toISOString().slice(0, 10) : null,
                next_amount: next ? Number(next.remainingAmount) : null,
                next_sequence: next?.sequence ?? null,
            };
        });
        const bookRemaining = items.reduce((s, i) => s + i.remaining_principal, 0);
        return {
            total,
            limit,
            offset,
            summary: { active: total, remaining_principal: Math.round(bookRemaining * 100) / 100 },
            items,
        };
    }
    async listTransactions(user, query) {
        if (!VIEW_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const where = {
            ...(query.applicationId ? { applicationId: query.applicationId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
        };
        const [total, rows] = await Promise.all([
            this.prisma.paymentTransaction.count({ where }),
            this.prisma.paymentTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    schedule: { select: { sequence: true, dueDate: true } },
                    application: {
                        select: {
                            customerEmail: true,
                            customer: { select: { name: true } },
                            product: { select: { make: true, model: true, modelYear: true } },
                            company: { select: { name: true } },
                        },
                    },
                },
            }),
        ]);
        return {
            total,
            limit,
            offset,
            items: rows.map((t) => ({
                id: t.id,
                application_id: t.applicationId,
                gateway: t.gateway,
                gateway_payment_id: t.gatewayPaymentId,
                amount: Number(t.amount),
                currency: t.currency,
                status: t.status,
                sequence: t.schedule?.sequence ?? null,
                due_date: t.schedule?.dueDate ? t.schedule.dueDate.toISOString().slice(0, 10) : null,
                customer_name: t.application.customer?.name ?? null,
                customer_email: t.application.customerEmail,
                vehicle: `${t.application.product.make} ${t.application.product.model} ${t.application.product.modelYear ?? ''}`.trim(),
                company_name: t.application.company.name,
                created_at: t.createdAt.toISOString(),
            })),
        };
    }
    async listSchedules(user, query) {
        if (!VIEW_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const baseWhere = {
            ...(query.applicationId ? { applicationId: query.applicationId } : {}),
            ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
        };
        const where = {
            ...baseWhere,
            ...(query.status ? { status: query.status } : {}),
        };
        const today = startOfTodayUtc();
        const [items, total, pending, overdueStored, pendingPastDue, paid] = await Promise.all([
            this.prisma.paymentSchedule.findMany({
                where,
                include: {
                    application: {
                        select: {
                            id: true,
                            status: true,
                            customerEmail: true,
                            customer: { select: { name: true } },
                            product: { select: { make: true, model: true, modelYear: true } },
                            company: { select: { name: true } },
                        },
                    },
                },
                orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
                take: limit,
                skip: offset,
            }),
            this.prisma.paymentSchedule.count({ where }),
            this.prisma.paymentSchedule.count({
                where: { ...baseWhere, status: client_1.ScheduleStatus.pending, dueDate: { gte: today } },
            }),
            this.prisma.paymentSchedule.count({
                where: { ...baseWhere, status: client_1.ScheduleStatus.overdue },
            }),
            this.prisma.paymentSchedule.count({
                where: { ...baseWhere, status: client_1.ScheduleStatus.pending, dueDate: { lt: today } },
            }),
            this.prisma.paymentSchedule.count({
                where: { ...baseWhere, status: client_1.ScheduleStatus.paid },
            }),
        ]);
        return {
            total,
            limit,
            offset,
            summary: {
                pending,
                overdue: overdueStored + pendingPastDue,
                paid,
            },
            items: items.map((s) => ({
                id: s.id,
                application_id: s.applicationId,
                application_status: s.application.status,
                customer_name: s.application.customer?.name ?? null,
                customer_email: s.application.customerEmail,
                vehicle: `${s.application.product.make} ${s.application.product.model} ${s.application.product.modelYear}`,
                company_name: s.application.company.name,
                sequence: s.sequence,
                due_date: s.dueDate.toISOString().slice(0, 10),
                amount: Number(s.amount),
                paid_amount: Number(s.paidAmount),
                remaining_amount: Number(s.remainingAmount),
                status: s.status,
                effective_status: s.status === client_1.ScheduleStatus.pending && s.dueDate < today
                    ? client_1.ScheduleStatus.overdue
                    : s.status,
                payment_method: s.paymentMethod,
                payment_reference: s.paymentReference,
                paid_at: s.paidAt?.toISOString() ?? null,
            })),
        };
    }
    async recordPayment(user, scheduleId, body) {
        this.assertPaymentRole(user);
        const schedule = await this.prisma.paymentSchedule.findUnique({
            where: { id: scheduleId },
            include: { application: { select: { id: true, status: true, customerUserId: true, companyId: true } } },
        });
        if (!schedule)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, schedule.application.companyId);
        const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
        await (0, separation_of_duties_1.assertSeparationOfDutiesForApplication)(this.prisma, user.id, schedule.application.id, sodEnabled);
        const result = await this.prisma.$transaction(async (tx) => {
            const locked = await lockScheduleForUpdate(tx, scheduleId);
            if (!locked)
                throw new common_1.NotFoundException();
            const application = await tx.application.findUnique({
                where: { id: locked.applicationId },
                select: {
                    id: true,
                    status: true,
                    customerUserId: true,
                    companyId: true,
                    pricingSnapshot: true,
                },
            });
            if (!application)
                throw new common_1.NotFoundException();
            if (application.status !== 'active') {
                throw new common_1.BadRequestException('application_not_active');
            }
            if (locked.status === client_1.ScheduleStatus.paid ||
                locked.status === client_1.ScheduleStatus.waived) {
                throw new common_1.BadRequestException('schedule_already_settled');
            }
            return applyPaymentInTransaction(tx, user, locked, application, body);
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'payment_schedule',
            entityId: scheduleId,
            action: 'payment_recorded',
            toValue: result.updated.status,
            metadata: {
                applicationId: result.applicationId,
                amount: result.amount.toFixed(2),
                method: body.method ?? null,
                reference: body.reference ?? null,
            },
        });
        if (result.applicationCompleted) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'application',
                entityId: result.applicationId,
                action: 'status_transition',
                fromValue: 'active',
                toValue: 'completed',
                metadata: { trigger: 'final_installment_paid' },
            });
            await this.activity.notify(result.customerUserId, 'Congratulations — you own your vehicle!', 'Your final installment is recorded. Your financing is complete.', `/app/applications/${result.applicationId}`);
        }
        this.analytics.track('payment_completed', {
            application_id: result.applicationId,
            schedule_id: scheduleId,
            amount: result.amount.toNumber(),
            method: body.method ?? 'manual',
        });
        return {
            schedule: (0, payment_response_dto_1.toPaymentScheduleDto)(result.updated),
            application_completed: result.applicationCompleted,
        };
    }
    async listPendingBank(user, query = {}) {
        this.assertPaymentRole(user);
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const where = {
            gateway: 'bank_transfer',
            status: { in: ['pending', 'failed'] },
            ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.paymentTransaction.findMany({
                where: { ...where, status: 'pending' },
                include: {
                    application: {
                        select: {
                            customerEmail: true,
                            customer: { select: { name: true } },
                            product: { select: { make: true, model: true } },
                            company: { select: { name: true } },
                        },
                    },
                    schedule: { select: { sequence: true, dueDate: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.paymentTransaction.count({ where: { ...where, status: 'pending' } }),
        ]);
        return {
            total,
            limit,
            offset,
            items: items.map((txn) => ({
                id: txn.id,
                application_id: txn.applicationId,
                schedule_id: txn.scheduleId,
                amount: Number(txn.amount),
                status: txn.status,
                customer_name: txn.application.customer?.name ?? null,
                customer_email: txn.application.customerEmail,
                vehicle: txn.application.product
                    ? `${txn.application.product.make} ${txn.application.product.model}`
                    : '',
                company_name: txn.application.company?.name ?? '',
                sequence: txn.schedule?.sequence ?? null,
                due_date: txn.schedule?.dueDate?.toISOString().slice(0, 10) ?? null,
                created_at: txn.createdAt.toISOString(),
            })),
        };
    }
    async createPendingBank(user, scheduleId, body) {
        this.assertPaymentRole(user);
        const schedule = await this.prisma.paymentSchedule.findUnique({
            where: { id: scheduleId },
            include: { application: { select: { id: true, companyId: true, status: true } } },
        });
        if (!schedule)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, schedule.application.companyId);
        if (schedule.application.status !== 'active') {
            throw new common_1.BadRequestException('application_not_active');
        }
        const amount = body.amount ?? Number(schedule.remainingAmount);
        const txn = await this.prisma.paymentTransaction.create({
            data: {
                gateway: 'bank_transfer',
                idempotencyKey: `bank:${scheduleId}:${Date.now()}:${user.id}`,
                amount,
                status: 'pending',
                applicationId: schedule.applicationId,
                scheduleId: schedule.id,
                rawPayloadRef: body.reference ?? null,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'payment_transaction',
            entityId: txn.id,
            action: 'bank_transfer_pending',
            metadata: { scheduleId, amount },
        });
        return (0, payment_response_dto_1.toPaymentTransactionDto)(txn);
    }
    async confirmBank(user, transactionId) {
        this.assertPaymentRole(user);
        const txn = await this.prisma.paymentTransaction.findUnique({
            where: { id: transactionId },
        });
        if (!txn || txn.gateway !== 'bank_transfer')
            throw new common_1.NotFoundException();
        if (txn.status !== 'pending')
            throw new common_1.BadRequestException('not_pending');
        if (!txn.scheduleId)
            throw new common_1.BadRequestException('validation_failed');
        const result = await this.recordPayment(user, txn.scheduleId, {
            amount: Number(txn.amount),
            method: 'bank_transfer',
            reference: txn.rawPayloadRef ?? txn.id,
        });
        await this.prisma.paymentTransaction.update({
            where: { id: txn.id },
            data: { status: 'completed' },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'payment_transaction',
            entityId: txn.id,
            action: 'bank_transfer_confirmed',
        });
        return result;
    }
    async requestWaiveSchedule(user, scheduleId, reason) {
        this.assertWaiveRole(user);
        if (!reason?.trim())
            throw new common_1.BadRequestException('validation_failed');
        const schedule = await this.prisma.paymentSchedule.findUnique({
            where: { id: scheduleId },
            include: { application: { select: { id: true, status: true, companyId: true } } },
        });
        if (!schedule)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, schedule.application.companyId);
        const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
        await (0, separation_of_duties_1.assertSeparationOfDutiesForApplication)(this.prisma, user.id, schedule.application.id, sodEnabled);
        const updated = await this.prisma.$transaction(async (tx) => {
            const locked = await lockScheduleForUpdate(tx, scheduleId);
            if (!locked)
                throw new common_1.NotFoundException();
            if (locked.status === client_1.ScheduleStatus.paid ||
                locked.status === client_1.ScheduleStatus.waived) {
                throw new common_1.BadRequestException('schedule_already_settled');
            }
            if (locked.pendingWaiveRequestedById) {
                throw new common_1.BadRequestException('waive_already_pending');
            }
            return tx.paymentSchedule.update({
                where: { id: scheduleId },
                data: {
                    pendingWaiveReason: reason.trim(),
                    pendingWaiveRequestedById: user.id,
                    pendingWaiveRequestedAt: new Date(),
                },
            });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'payment_schedule',
            entityId: scheduleId,
            action: 'payment_waive_requested',
            metadata: {
                applicationId: schedule.application.id,
                reason: reason.trim(),
                requestedById: user.id,
            },
        });
        return { schedule: (0, payment_response_dto_1.toPaymentScheduleDto)(updated) };
    }
    async confirmWaiveSchedule(user, scheduleId) {
        this.assertWaiveRole(user);
        const schedule = await this.prisma.paymentSchedule.findUnique({
            where: { id: scheduleId },
            include: { application: { select: { id: true, status: true, customerUserId: true, companyId: true } } },
        });
        if (!schedule)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, schedule.application.companyId);
        const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
        await (0, separation_of_duties_1.assertSeparationOfDutiesForApplication)(this.prisma, user.id, schedule.application.id, sodEnabled);
        (0, separation_of_duties_1.assertDualControlWaive)(user.id, schedule.pendingWaiveRequestedById);
        const waiveReason = schedule.pendingWaiveReason?.trim();
        if (!waiveReason)
            throw new common_1.BadRequestException('waive_not_requested');
        const requestedById = schedule.pendingWaiveRequestedById;
        const result = await this.prisma.$transaction(async (tx) => {
            const locked = await lockScheduleForUpdate(tx, scheduleId);
            if (!locked)
                throw new common_1.NotFoundException();
            if (!locked.pendingWaiveRequestedById || !locked.pendingWaiveReason?.trim()) {
                throw new common_1.BadRequestException('waive_not_requested');
            }
            (0, separation_of_duties_1.assertDualControlWaive)(user.id, locked.pendingWaiveRequestedById);
            const application = await tx.application.findUnique({
                where: { id: locked.applicationId },
                select: {
                    id: true,
                    status: true,
                    customerUserId: true,
                    companyId: true,
                    pricingSnapshot: true,
                },
            });
            if (!application)
                throw new common_1.NotFoundException();
            return applyWaiveInTransaction(tx, user, locked, application, locked.pendingWaiveReason.trim(), requestedById);
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'payment_schedule',
            entityId: scheduleId,
            action: 'payment_waived',
            toValue: 'waived',
            metadata: {
                applicationId: result.applicationId,
                reason: waiveReason,
                requestedById,
                confirmedById: user.id,
            },
        });
        return {
            schedule: (0, payment_response_dto_1.toPaymentScheduleDto)(result.updated),
            application_completed: result.applicationCompleted,
        };
    }
    async markOverdueSystem() {
        const today = startOfTodayUtc();
        const result = await this.prisma.paymentSchedule.updateMany({
            where: { status: client_1.ScheduleStatus.pending, dueDate: { lt: today } },
            data: { status: client_1.ScheduleStatus.overdue },
        });
        if (result.count > 0) {
            await this.activity.log({
                actorUserId: system_actor_1.SYSTEM_ACTOR_USER_ID,
                entityType: 'payment_schedule',
                entityId: 'bulk',
                action: 'overdue_sweep',
                toValue: String(result.count),
            });
        }
        return { marked_overdue: result.count };
    }
    async markOverdue(user) {
        this.assertPaymentRole(user);
        return this.markOverdueSystem();
    }
    async createSkipCashPayment(user, applicationId, scheduleId) {
        if (user.role !== client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        (0, settle_all_guard_1.assertNotSettleAll)({ scheduleId });
        const schedule = await this.prisma.paymentSchedule.findUnique({
            where: { id: scheduleId },
            include: {
                application: {
                    include: { company: { select: { canPay: true } } },
                },
            },
        });
        if (!schedule || schedule.applicationId !== applicationId)
            throw new common_1.NotFoundException();
        if (schedule.application.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (schedule.application.status !== 'active') {
            throw new common_1.BadRequestException('application_not_active');
        }
        if (!schedule.application.company.canPay) {
            throw new common_1.BadRequestException('payments_not_enabled');
        }
        if (schedule.status === client_1.ScheduleStatus.paid || schedule.status === client_1.ScheduleStatus.waived) {
            throw new common_1.BadRequestException('schedule_already_settled');
        }
        const windowMs = this.skipCashOpenWindowMs();
        const windowStart = new Date(Date.now() - windowMs);
        const existingPending = await this.prisma.paymentTransaction.findFirst({
            where: {
                scheduleId,
                gateway: 'skipcash',
                status: 'pending',
                createdAt: { gte: windowStart },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existingPending) {
            return this.serializeSkipCashPayment(existingPending, applicationId);
        }
        const windowBucket = Math.floor(Date.now() / windowMs);
        const idempotencyKey = `skipcash:${scheduleId}:${windowBucket}`;
        const amount = schedule.remainingAmount;
        try {
            const txn = await this.prisma.paymentTransaction.create({
                data: {
                    gateway: 'skipcash',
                    idempotencyKey,
                    amount,
                    applicationId,
                    scheduleId,
                    status: 'pending',
                },
            });
            this.analytics.track('payment_started', {
                application_id: applicationId,
                schedule_id: scheduleId,
                amount: amount.toNumber(),
                gateway: 'skipcash',
            });
            return this.serializeSkipCashPayment(txn, applicationId);
        }
        catch (err) {
            if (!(0, prisma_errors_1.isUniqueConstraintError)(err))
                throw err;
            const txn = (await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey } })) ??
                (await this.prisma.paymentTransaction.findFirst({
                    where: {
                        scheduleId,
                        gateway: 'skipcash',
                        status: 'pending',
                        createdAt: { gte: windowStart },
                    },
                    orderBy: { createdAt: 'desc' },
                }));
            if (txn) {
                return this.serializeSkipCashPayment(txn, applicationId);
            }
            throw err;
        }
    }
    async initiateMobileInstallmentPayment(user, input) {
        (0, settle_all_guard_1.assertNotSettleAll)({ scheduleId: input.scheduleId, custom1: input.custom1 });
        const base = await this.createSkipCashPayment(user, input.applicationId, input.scheduleId);
        let txn = await this.prisma.paymentTransaction.findUnique({
            where: { id: base.transaction_id },
        });
        if (!txn)
            throw new common_1.NotFoundException();
        const clientTx = input.transactionId?.trim();
        if (clientTx) {
            txn = await this.prisma.paymentTransaction.update({
                where: { id: txn.id },
                data: {
                    rawPayloadRef: JSON.stringify({
                        type: 'installment_payment',
                        clientTransactionId: clientTx,
                        applicationId: input.applicationId,
                        scheduleId: input.scheduleId,
                    }),
                },
            });
        }
        const amount = txn.amount.toNumber();
        const checkoutTx = clientTx || txn.id;
        return this.attachSkipCashCheckout(txn, {
            amount,
            firstName: input.firstName?.trim() || 'Customer',
            lastName: input.lastName?.trim() || 'User',
            phone: input.phone?.trim() || '+97400000000',
            email: input.email?.trim() || user.email,
            transactionId: checkoutTx,
            returnUrl: input.returnUrl,
            custom1: input.custom1,
            subject: input.subject,
            description: input.description,
            onlyDebitCard: input.onlyDebitCard,
            applicationId: input.applicationId,
        });
    }
    async createCreditTopUpPayment(user, input) {
        if (user.role !== client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        if (input.amount <= 0)
            throw new common_1.BadRequestException('invalid_amount');
        let creditsAmount = 0;
        if (input.custom1) {
            try {
                const custom = JSON.parse(input.custom1);
                if (custom.type === 'credit_topup' && custom.creditsAmount) {
                    creditsAmount = Number(custom.creditsAmount);
                    const expected = creditsAmount * BLOX_CREDIT_QAR_VALUE;
                    if (Math.abs(expected - input.amount) > 0.01) {
                        throw new common_1.BadRequestException('credit_price_mismatch');
                    }
                }
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException)
                    throw err;
            }
        }
        const anchorApp = await this.prisma.application.findFirst({
            where: { customerUserId: user.id },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
        });
        if (!anchorApp)
            throw new common_1.BadRequestException('no_application_for_credit_topup');
        const clientTx = input.transactionId.trim();
        const idempotencyKey = `credit-topup:${user.id}:${clientTx}`;
        const existing = await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey } });
        if (existing) {
            return this.attachSkipCashCheckout(existing, {
                amount: existing.amount.toNumber(),
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                email: input.email,
                transactionId: clientTx,
                returnUrl: input.returnUrl,
                custom1: input.custom1,
                subject: input.subject,
                description: input.description,
            });
        }
        const payload = JSON.stringify({
            type: 'credit_topup',
            clientTransactionId: clientTx,
            creditsAmount: creditsAmount || Math.floor(input.amount / BLOX_CREDIT_QAR_VALUE),
            email: input.email.toLowerCase(),
        });
        const txn = await this.prisma.paymentTransaction.create({
            data: {
                gateway: 'skipcash',
                idempotencyKey,
                amount: input.amount,
                applicationId: anchorApp.id,
                status: 'pending',
                rawPayloadRef: payload,
            },
        });
        return this.attachSkipCashCheckout(txn, {
            amount: input.amount,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            email: input.email,
            transactionId: clientTx,
            returnUrl: input.returnUrl,
            custom1: input.custom1,
            subject: input.subject,
            description: input.description,
        });
    }
    async mobileVerifySkipCash(user, input) {
        const gatewayPaymentId = input.gatewayPaymentId?.trim() ||
            input.paymentId?.trim() ||
            undefined;
        const clientTx = input.transactionId?.trim();
        const idempotencyKey = input.idempotencyKey?.trim();
        let txn = gatewayPaymentId != null
            ? await this.prisma.paymentTransaction.findFirst({
                where: { gatewayPaymentId, gateway: 'skipcash' },
                include: { application: { select: { customerUserId: true } } },
            })
            : null;
        if (!txn && idempotencyKey) {
            txn = await this.prisma.paymentTransaction.findFirst({
                where: { idempotencyKey, gateway: 'skipcash' },
                include: { application: { select: { customerUserId: true } } },
            });
        }
        if (!txn && clientTx) {
            txn = await this.prisma.paymentTransaction.findFirst({
                where: {
                    OR: [
                        { idempotencyKey: `credit-topup:${user.id}:${clientTx}` },
                        { id: clientTx },
                        { gatewayPaymentId: clientTx },
                        { rawPayloadRef: { contains: clientTx } },
                    ],
                    gateway: 'skipcash',
                },
                include: { application: { select: { customerUserId: true } } },
            });
        }
        if (!txn || txn.application.customerUserId !== user.id) {
            throw new common_1.NotFoundException();
        }
        if (txn.status === 'completed') {
            return this.formatMobileVerifyResponse(txn, 'completed', true);
        }
        const client = this.skipCashClient();
        const resolvedGatewayId = gatewayPaymentId ?? txn.gatewayPaymentId ?? undefined;
        if (client && resolvedGatewayId) {
            const remote = await client.getPayment(resolvedGatewayId);
            if (!(0, skipcash_client_1.mapSkipCashPaid)(remote.status ?? remote.statusId)) {
                return this.formatMobileVerifyResponse(txn, 'pending', false);
            }
            if (txn.scheduleId) {
                await this.sandboxCompleteSkipCashPayment(txn.idempotencyKey, resolvedGatewayId);
            }
            else {
                await this.completeCreditTopUpPayment(txn.idempotencyKey, resolvedGatewayId);
            }
            const refreshed = await this.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: txn.id } });
            return this.formatMobileVerifyResponse(refreshed, 'completed', true);
        }
        if (this.isSkipCashSandbox()) {
            if (txn.scheduleId) {
                await this.sandboxCompleteSkipCashPayment(txn.idempotencyKey, resolvedGatewayId);
            }
            else {
                await this.completeCreditTopUpPayment(txn.idempotencyKey, resolvedGatewayId);
            }
            const refreshed = await this.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: txn.id } });
            return this.formatMobileVerifyResponse(refreshed, 'completed', true);
        }
        throw new common_1.NotImplementedException('skipcash_verify_not_implemented');
    }
    formatMobileVerifyResponse(txn, dbStatus, dbConfirmed) {
        const statusId = dbStatus === 'completed' ? 2 : dbStatus === 'failed' ? 4 : dbStatus === 'cancelled' ? 3 : 1;
        return {
            data: {
                status: dbStatus,
                statusId,
                dbStatus,
                dbConfirmed,
                transactionId: txn.id,
                amount: txn.amount.toNumber(),
            },
        };
    }
    async completeCreditTopUpPayment(idempotencyKey, gatewayPaymentId) {
        const txn = await this.prisma.paymentTransaction.findFirst({ where: { idempotencyKey } });
        if (!txn)
            throw new common_1.NotFoundException();
        if (txn.status === 'completed') {
            return { transaction: (0, payment_response_dto_1.toPaymentTransactionDto)(txn), already_completed: true };
        }
        if (txn.scheduleId)
            throw new common_1.BadRequestException('validation_failed');
        await this.prisma.paymentTransaction.updateMany({
            where: { id: txn.id, status: 'pending' },
            data: {
                status: 'completed',
                gatewayPaymentId: gatewayPaymentId ?? txn.gatewayPaymentId ?? txn.id,
            },
        });
        const refreshed = await this.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: txn.id } });
        return { transaction: (0, payment_response_dto_1.toPaymentTransactionDto)(refreshed), already_completed: false };
    }
    skipCashOpenWindowMs() {
        const raw = this.config.get('SKIPCASH_OPEN_WINDOW_MS');
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SKIPCASH_OPEN_WINDOW_MS;
    }
    serializeSkipCashPayment(txn, applicationId) {
        const returnUrl = `${this.appConfig.marketplacePath(`/app/applications/${applicationId}`)}?skipcash_key=${encodeURIComponent(txn.idempotencyKey)}`;
        return {
            transaction_id: txn.id,
            idempotency_key: txn.idempotencyKey,
            amount: txn.amount.toNumber(),
            currency: 'QAR',
            redirect_url: returnUrl,
            sandbox: true,
        };
    }
    async verifyAndComplete(gatewayPaymentId) {
        const apiUrl = this.config.get('SKIPCASH_API_URL')?.replace(/\/$/, '');
        const apiKey = this.config.get('SKIPCASH_API_KEY')?.trim();
        if (!apiUrl || !apiKey) {
            throw new common_1.NotImplementedException('skipcash_verify_not_implemented');
        }
        const res = await fetch(`${apiUrl}/api/v1/payments/${encodeURIComponent(gatewayPaymentId)}`, {
            headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
        });
        if (!res.ok) {
            throw new common_1.BadRequestException('gateway_verification_failed');
        }
        const body = (await res.json());
        if (String(body.status).toLowerCase() !== 'paid' && String(body.status).toLowerCase() !== 'success') {
            throw new common_1.BadRequestException('payment_not_completed');
        }
        const txn = await this.prisma.paymentTransaction.findFirst({
            where: { gatewayPaymentId, gateway: 'skipcash' },
        });
        if (!txn)
            throw new common_1.NotFoundException();
        return this.sandboxCompleteSkipCashPayment(txn.idempotencyKey, gatewayPaymentId);
    }
    async completeSkipCashPayment(idempotencyKey, gatewayPaymentId) {
        if (!this.isSkipCashSandbox()) {
            throw new common_1.ForbiddenException('gateway_verification_required');
        }
        this.logger.warn(`SkipCash SANDBOX completion for idempotency key ${idempotencyKey} — payment NOT verified against gateway`);
        return this.sandboxCompleteSkipCashPayment(idempotencyKey, gatewayPaymentId);
    }
    async sandboxCompleteSkipCashPayment(idempotencyKey, gatewayPaymentId) {
        const txn = await this.prisma.paymentTransaction.findFirst({
            where: { idempotencyKey },
        });
        if (!txn)
            throw new common_1.NotFoundException();
        if (txn.status === 'completed') {
            return { transaction: (0, payment_response_dto_1.toPaymentTransactionDto)(txn), already_completed: true };
        }
        if (!txn.scheduleId)
            throw new common_1.BadRequestException('validation_failed');
        const systemUser = system_actor_1.SYSTEM_ACTOR;
        const result = await this.prisma.$transaction(async (tx) => {
            const completed = await tx.paymentTransaction.updateMany({
                where: { id: txn.id, status: 'pending' },
                data: {
                    status: 'completed',
                    gatewayPaymentId: gatewayPaymentId ?? txn.id,
                },
            });
            (0, guarded_transitions_1.assertRowsUpdated)(completed.count, 'stale_transition');
            const locked = await lockScheduleForUpdate(tx, txn.scheduleId);
            if (!locked)
                throw new common_1.NotFoundException();
            const application = await tx.application.findUnique({
                where: { id: locked.applicationId },
                select: {
                    id: true,
                    status: true,
                    customerUserId: true,
                    companyId: true,
                    pricingSnapshot: true,
                },
            });
            if (!application)
                throw new common_1.NotFoundException();
            return applyPaymentInTransaction(tx, systemUser, locked, application, {
                amount: txn.amount,
                method: 'skipcash',
                reference: gatewayPaymentId ?? txn.id,
            });
        });
        await this.activity.log({
            actorUserId: systemUser.id,
            entityType: 'payment_schedule',
            entityId: txn.scheduleId,
            action: 'payment_recorded',
            toValue: result.updated.status,
            metadata: {
                applicationId: result.applicationId,
                amount: result.amount.toFixed(2),
                method: 'skipcash',
                reference: gatewayPaymentId ?? txn.id,
                skipcash: true,
            },
        });
        if (result.applicationCompleted) {
            await this.activity.log({
                actorUserId: systemUser.id,
                entityType: 'application',
                entityId: result.applicationId,
                action: 'status_transition',
                fromValue: 'active',
                toValue: 'completed',
                metadata: { trigger: 'final_installment_paid', skipcash: true },
            });
            await this.activity.notify(result.customerUserId, 'Congratulations — you own your vehicle!', 'Your final installment is recorded. Your financing is complete.', `/app/applications/${result.applicationId}`);
        }
        this.analytics.track('payment_completed', {
            application_id: result.applicationId,
            schedule_id: txn.scheduleId,
            amount: result.amount.toNumber(),
            method: 'skipcash',
            gateway: 'skipcash',
        });
        return {
            transaction_id: txn.id,
            schedule: (0, payment_response_dto_1.toPaymentScheduleDto)(result.updated),
            application_completed: result.applicationCompleted,
            already_completed: false,
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        analytics_service_1.AnalyticsService,
        config_1.ConfigService,
        app_config_service_1.AppConfigService])
], PaymentsService);
function startOfTodayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
async function lockScheduleForUpdate(tx, scheduleId) {
    const rows = await tx.$queryRaw `
    SELECT
      id,
      "applicationId",
      sequence,
      "dueDate",
      amount,
      "paidAmount",
      "remainingAmount",
      status,
      "paymentMethod",
      "paymentReference",
      "paidAt",
      "pendingWaiveReason",
      "pendingWaiveRequestedById",
      "pendingWaiveRequestedAt"
    FROM payment_schedules
    WHERE id = ${scheduleId}
    FOR UPDATE
  `;
    return rows[0] ?? null;
}
async function applyWaiveInTransaction(tx, user, locked, application, reason, requestedById) {
    if (locked.status === client_1.ScheduleStatus.paid ||
        locked.status === client_1.ScheduleStatus.waived) {
        throw new common_1.BadRequestException('schedule_already_settled');
    }
    const forgiven = locked.remainingAmount;
    await tx.paymentEvent.create({
        data: {
            applicationId: locked.applicationId,
            scheduleId: locked.id,
            type: client_1.PaymentEventType.waive,
            amount: forgiven,
            currency: 'QAR',
            actorUserId: user.id,
            reason,
            metadata: { requestedById, confirmedById: user.id },
        },
    });
    const ledger = await (0, payment_ledger_1.computeScheduleAmountsFromEvents)(tx, locked.id, locked.amount);
    const updated = await tx.paymentSchedule.update({
        where: { id: locked.id },
        data: {
            paidAmount: ledger.paidAmount,
            remainingAmount: ledger.remainingAmount,
            status: client_1.ScheduleStatus.waived,
            pendingWaiveReason: null,
            pendingWaiveRequestedById: null,
            pendingWaiveRequestedAt: null,
        },
    });
    assertLedgerMatchesCache(ledger, updated);
    let applicationCompleted = false;
    const unsettled = await tx.paymentSchedule.count({
        where: {
            applicationId: locked.applicationId,
            status: { in: [client_1.ScheduleStatus.pending, client_1.ScheduleStatus.overdue] },
        },
    });
    if (unsettled === 0 && application.status === 'active') {
        await (0, guarded_transitions_1.transitionApplication)(tx, locked.applicationId, client_1.ApplicationStatus.active, {
            status: client_1.ApplicationStatus.completed,
            completedAt: new Date(),
        });
        applicationCompleted = true;
    }
    return {
        updated,
        applicationCompleted,
        applicationId: locked.applicationId,
        customerUserId: application.customerUserId,
    };
}
async function applyPaymentInTransaction(tx, user, locked, application, body) {
    if (application.status !== 'active') {
        throw new common_1.BadRequestException('application_not_active');
    }
    if (locked.status === client_1.ScheduleStatus.paid ||
        locked.status === client_1.ScheduleStatus.waived) {
        throw new common_1.BadRequestException('schedule_already_settled');
    }
    const remaining = locked.remainingAmount;
    const payAmount = body.amount != null
        ? body.amount instanceof client_1.Prisma.Decimal
            ? body.amount
            : new client_1.Prisma.Decimal(String(body.amount))
        : remaining;
    if (payAmount.lte(0)) {
        throw new common_1.BadRequestException('validation_failed');
    }
    if (payAmount.gt(remaining)) {
        throw new common_1.BadRequestException('amount_exceeds_remaining');
    }
    const pricingSnapshot = application.pricingSnapshot != null &&
        typeof application.pricingSnapshot === 'object' &&
        !Array.isArray(application.pricingSnapshot)
        ? application.pricingSnapshot
        : null;
    const scheduledPrincipal = pricingSnapshot
        ? ((0, pricing_1.principalAmountsFromPricingSnapshot)(pricingSnapshot)[locked.sequence - 1] ?? 0)
        : 0;
    const principalAmount = pricingSnapshot
        ? (0, pricing_1.principalCollectedFromInstallment)(payAmount.toNumber(), locked.amount.toNumber(), scheduledPrincipal)
        : payAmount.toNumber();
    await tx.paymentEvent.create({
        data: {
            applicationId: locked.applicationId,
            scheduleId: locked.id,
            type: client_1.PaymentEventType.installment,
            amount: payAmount,
            currency: 'QAR',
            actorUserId: user.id,
            metadata: {
                method: body.method ?? null,
                reference: body.reference ?? null,
                principalAmount,
            },
        },
    });
    const ledger = await (0, payment_ledger_1.computeScheduleAmountsFromEvents)(tx, locked.id, locked.amount);
    const fullyPaid = ledger.remainingAmount.lte(0);
    const updated = await tx.paymentSchedule.update({
        where: { id: locked.id },
        data: {
            paidAmount: ledger.paidAmount,
            remainingAmount: ledger.remainingAmount,
            status: fullyPaid ? client_1.ScheduleStatus.paid : locked.status,
            paymentMethod: body.method ?? locked.paymentMethod,
            paymentReference: body.reference ?? locked.paymentReference,
            paidAt: fullyPaid ? new Date() : locked.paidAt,
        },
    });
    assertLedgerMatchesCache(ledger, updated);
    let applicationCompleted = false;
    if (fullyPaid) {
        const unsettled = await tx.paymentSchedule.count({
            where: {
                applicationId: locked.applicationId,
                status: { in: [client_1.ScheduleStatus.pending, client_1.ScheduleStatus.overdue] },
            },
        });
        if (unsettled === 0) {
            await (0, guarded_transitions_1.transitionApplication)(tx, locked.applicationId, client_1.ApplicationStatus.active, {
                status: client_1.ApplicationStatus.completed,
                completedAt: new Date(),
            });
            applicationCompleted = true;
        }
    }
    return {
        updated,
        applicationCompleted,
        applicationId: locked.applicationId,
        customerUserId: application.customerUserId,
        amount: payAmount,
    };
}
function decimalEq(a, b) {
    return a.toFixed(2) === b.toFixed(2);
}
function assertLedgerMatchesCache(ledger, cache) {
    if (!decimalEq(ledger.paidAmount, cache.paidAmount)) {
        throw new common_1.BadRequestException('ledger_cache_mismatch');
    }
    if (!decimalEq(ledger.remainingAmount, cache.remainingAmount)) {
        throw new common_1.BadRequestException('ledger_cache_mismatch');
    }
}
//# sourceMappingURL=payments.service.js.map