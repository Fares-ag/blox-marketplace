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
exports.CreditsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const idempotency_service_1 = require("../common/idempotency.service");
const settle_all_guard_1 = require("../payments/settle-all-guard");
const credits_ledger_1 = require("./credits-ledger");
const BLOX_CREDIT_QAR_VALUE = 250;
function roundWallet(value) {
    return Math.round(value * 1000) / 1000;
}
let CreditsService = class CreditsService {
    prisma;
    idempotency;
    constructor(prisma, idempotency) {
        this.prisma = prisma;
        this.idempotency = idempotency;
    }
    async getBalance(user) {
        const row = await this.prisma.userCredit.findUnique({ where: { userId: user.id } });
        return { balance: row ? Number(row.balance) : 0 };
    }
    async ensureRow(userId) {
        return this.prisma.userCredit.upsert({
            where: { userId },
            update: {},
            create: { userId, balance: 0 },
        });
    }
    async payInstallment(user, applicationId, dueDate, amount) {
        if (!Number.isFinite(amount) || amount <= 0)
            throw new common_1.BadRequestException('invalid_amount');
        (0, settle_all_guard_1.assertNotSettleAll)({ dueDate });
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.NotFoundException();
        const due = new Date(dueDate);
        if (Number.isNaN(due.getTime()))
            throw new common_1.BadRequestException('validation_failed');
        const schedule = await this.prisma.paymentSchedule.findFirst({
            where: { applicationId, dueDate: due },
        });
        if (!schedule)
            throw new common_1.NotFoundException('schedule_not_found');
        if (schedule.status === client_1.ScheduleStatus.paid || schedule.status === client_1.ScheduleStatus.waived) {
            throw new common_1.BadRequestException('schedule_already_settled');
        }
        const debit = roundWallet(amount);
        return this.prisma.$transaction(async (tx) => {
            const credit = await tx.userCredit.findUnique({ where: { userId: user.id } });
            const balance = credit ? Number(credit.balance) : 0;
            if (balance < debit)
                throw new common_1.BadRequestException('insufficient_credits');
            const nextBalance = roundWallet(balance - debit);
            await tx.userCredit.update({
                where: { userId: user.id },
                data: { balance: new client_1.Prisma.Decimal(nextBalance) },
            });
            const wallet = await tx.creditTransaction.create({
                data: {
                    userId: user.id,
                    action: credits_ledger_1.BLOX_CREDITS_WALLET_ACTION,
                    amount: new client_1.Prisma.Decimal(debit),
                    balanceAfter: new client_1.Prisma.Decimal(nextBalance),
                    actorUserId: user.id,
                },
            });
            const entry = (0, credits_ledger_1.buildBloxCreditsLedgerEntry)({
                creditTransactionId: wallet.id,
                amount: debit,
                applicationId,
                scheduleId: schedule.id,
                scheduleSequence: schedule.sequence,
                actorUserId: user.id,
            });
            await tx.creditTransaction.update({
                where: { id: wallet.id },
                data: { description: entry.description },
            });
            await tx.paymentEvent.create({ data: entry.paymentEvent });
            const remaining = Math.max(0, Math.round((Number(schedule.remainingAmount) - debit) * 100) / 100);
            const paidAmount = Math.round((Number(schedule.paidAmount) + debit) * 100) / 100;
            await tx.paymentSchedule.update({
                where: { id: schedule.id },
                data: {
                    paidAmount,
                    remainingAmount: remaining,
                    status: remaining <= 0 ? client_1.ScheduleStatus.paid : schedule.status,
                    paidAt: remaining <= 0 ? new Date() : schedule.paidAt,
                    paymentMethod: 'credits',
                    paymentReference: entry.reference,
                },
            });
            return {
                ok: true,
                remaining,
                balance: nextBalance,
                reference: entry.reference,
                credit_transaction_id: wallet.id,
                credits_debited: debit,
            };
        });
    }
    async listBalances(query) {
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
        const offset = Math.max(Number(query.offset) || 0, 0);
        const q = query.q?.trim();
        const where = q
            ? {
                user: {
                    OR: [
                        { email: { contains: q, mode: 'insensitive' } },
                        { name: { contains: q, mode: 'insensitive' } },
                    ],
                },
            }
            : {};
        const [total, rows] = await Promise.all([
            this.prisma.userCredit.count({ where }),
            this.prisma.userCredit.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip: offset,
                take: limit,
                include: { user: { select: { id: true, email: true, name: true } } },
            }),
        ]);
        return {
            total,
            limit,
            offset,
            items: rows.map((r) => ({
                user_id: r.userId,
                email: r.user.email,
                name: r.user.name,
                balance: Number(r.balance),
                updated_at: r.updatedAt.toISOString(),
            })),
        };
    }
    async adminBalance(userId) {
        await this.ensureRow(userId);
        const [row, transactions] = await Promise.all([
            this.prisma.userCredit.findUnique({ where: { userId } }),
            this.prisma.creditTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ]);
        return {
            balance: row ? Number(row.balance) : 0,
            transactions: transactions.map((t) => ({
                id: t.id,
                action: t.action,
                amount: Number(t.amount),
                balance_after: Number(t.balanceAfter),
                description: t.description,
                created_at: t.createdAt.toISOString(),
            })),
        };
    }
    async adminAdjust(actor, userId, action, amount, description) {
        if (amount < 0)
            throw new common_1.BadRequestException('invalid_amount');
        await this.ensureRow(userId);
        const current = await this.prisma.userCredit.findUnique({ where: { userId } });
        const balance = current ? Number(current.balance) : 0;
        const next = action === 'add' ? balance + amount : action === 'subtract' ? Math.max(0, balance - amount) : amount;
        const updated = await this.prisma.userCredit.update({
            where: { userId },
            data: { balance: new client_1.Prisma.Decimal(next) },
        });
        await this.prisma.creditTransaction.create({
            data: {
                userId,
                action,
                amount,
                balanceAfter: next,
                description,
                actorUserId: actor.id,
            },
        });
        return { balance: Number(updated.balance) };
    }
    async claim(user, amount) {
        if (amount <= 0)
            throw new common_1.BadRequestException('invalid_amount');
        await this.ensureRow(user.id);
        const updated = await this.prisma.userCredit.update({
            where: { userId: user.id },
            data: { balance: { increment: amount } },
        });
        return { balance: Number(updated.balance) };
    }
    async claimFromTopUp(user, transactionId) {
        return this.idempotency.run({
            userId: user.id,
            scope: 'mobile-credits-claim',
            idempotencyKey: transactionId,
            handler: async () => {
                const txn = await this.prisma.paymentTransaction.findFirst({
                    where: {
                        idempotencyKey: `credit-topup:${user.id}:${transactionId}`,
                        gateway: 'skipcash',
                    },
                });
                if (!txn)
                    throw new common_1.NotFoundException('payment_not_found');
                if (txn.status !== 'completed') {
                    throw new common_1.NotFoundException('payment_not_completed');
                }
                let creditsAmount = Math.floor(Number(txn.amount) / BLOX_CREDIT_QAR_VALUE);
                if (txn.rawPayloadRef) {
                    try {
                        const meta = JSON.parse(txn.rawPayloadRef);
                        if (meta.creditsAmount && meta.creditsAmount > 0) {
                            creditsAmount = meta.creditsAmount;
                        }
                        if (meta.claimed) {
                            const balance = await this.getBalance(user);
                            return {
                                balance: balance.balance,
                                credits_added: 0,
                                message: 'Credits already added',
                            };
                        }
                    }
                    catch {
                    }
                }
                await this.ensureRow(user.id);
                const updated = await this.prisma.userCredit.update({
                    where: { userId: user.id },
                    data: { balance: { increment: creditsAmount } },
                });
                if (txn.rawPayloadRef) {
                    try {
                        const meta = JSON.parse(txn.rawPayloadRef);
                        await this.prisma.paymentTransaction.update({
                            where: { id: txn.id },
                            data: {
                                rawPayloadRef: JSON.stringify({ ...meta, claimed: true }),
                            },
                        });
                    }
                    catch {
                    }
                }
                return {
                    balance: Number(updated.balance),
                    credits_added: creditsAmount,
                    message: 'Credits added',
                };
            },
        });
    }
};
exports.CreditsService = CreditsService;
exports.CreditsService = CreditsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        idempotency_service_1.IdempotencyService])
], CreditsService);
//# sourceMappingURL=credits.service.js.map