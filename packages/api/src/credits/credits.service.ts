import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ScheduleStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyService } from '../common/idempotency.service';
import { assertNotSettleAll } from '../payments/settle-all-guard';
import { BLOX_CREDITS_WALLET_ACTION, buildBloxCreditsLedgerEntry } from './credits-ledger';

const BLOX_CREDIT_QAR_VALUE = 250;

/** Wallet balances are stored with three decimals. */
function roundWallet(value: number): number {
  return Math.round(value * 1000) / 1000;
}

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async getBalance(user: User) {
    const row = await this.prisma.userCredit.findUnique({ where: { userId: user.id } });
    return { balance: row ? Number(row.balance) : 0 };
  }

  async ensureRow(userId: string) {
    return this.prisma.userCredit.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  /**
   * Pay (part of) an installment from the Blox-credits wallet. The wallet
   * debit and a `blox_credits` payment event land in the same transaction and
   * share the reference `CR-<creditTransactionId>`, so the schedule ledger
   * (`computeScheduleAmountsFromEvents`) and finance reconciliation both see
   * the credits exactly like a cash receipt.
   */
  async payInstallment(user: User, applicationId: string, dueDate: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('invalid_amount');
    // Sweeping the whole remainder with credits is a settlement: quote first.
    assertNotSettleAll({ dueDate });
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) throw new BadRequestException('validation_failed');
    const schedule = await this.prisma.paymentSchedule.findFirst({
      where: { applicationId, dueDate: due },
    });
    if (!schedule) throw new NotFoundException('schedule_not_found');
    if (schedule.status === ScheduleStatus.paid || schedule.status === ScheduleStatus.waived) {
      throw new BadRequestException('schedule_already_settled');
    }

    const debit = roundWallet(amount);
    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.userCredit.findUnique({ where: { userId: user.id } });
      const balance = credit ? Number(credit.balance) : 0;
      if (balance < debit) throw new BadRequestException('insufficient_credits');
      const nextBalance = roundWallet(balance - debit);

      await tx.userCredit.update({
        where: { userId: user.id },
        data: { balance: new Prisma.Decimal(nextBalance) },
      });

      // Wallet transaction first (its id is the ledger reference), then the
      // payment event carrying the same reference.
      const wallet = await tx.creditTransaction.create({
        data: {
          userId: user.id,
          action: BLOX_CREDITS_WALLET_ACTION,
          amount: new Prisma.Decimal(debit),
          balanceAfter: new Prisma.Decimal(nextBalance),
          actorUserId: user.id,
        },
      });
      const entry = buildBloxCreditsLedgerEntry({
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
          status: remaining <= 0 ? ScheduleStatus.paid : schedule.status,
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

  async listBalances(query: { q?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const q = query.q?.trim();
    const where: Prisma.UserCreditWhereInput = q
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

  async adminBalance(userId: string) {
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

  async adminAdjust(
    actor: User,
    userId: string,
    action: 'add' | 'subtract' | 'set',
    amount: number,
    description?: string,
  ) {
    if (amount < 0) throw new BadRequestException('invalid_amount');
    await this.ensureRow(userId);
    const current = await this.prisma.userCredit.findUnique({ where: { userId } });
    const balance = current ? Number(current.balance) : 0;
    const next =
      action === 'add' ? balance + amount : action === 'subtract' ? Math.max(0, balance - amount) : amount;
    const updated = await this.prisma.userCredit.update({
      where: { userId },
      data: { balance: new Prisma.Decimal(next) },
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

  async claim(user: User, amount: number) {
    if (amount <= 0) throw new BadRequestException('invalid_amount');
    await this.ensureRow(user.id);
    const updated = await this.prisma.userCredit.update({
      where: { userId: user.id },
      data: { balance: { increment: amount } },
    });
    return { balance: Number(updated.balance) };
  }

  async claimFromTopUp(user: User, transactionId: string) {
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
        if (!txn) throw new NotFoundException('payment_not_found');
        if (txn.status !== 'completed') {
          throw new NotFoundException('payment_not_completed');
        }

        let creditsAmount = Math.floor(Number(txn.amount) / BLOX_CREDIT_QAR_VALUE);
        if (txn.rawPayloadRef) {
          try {
            const meta = JSON.parse(txn.rawPayloadRef) as { creditsAmount?: number; claimed?: boolean };
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
          } catch {
            /* ignore malformed payload */
          }
        }

        await this.ensureRow(user.id);
        const updated = await this.prisma.userCredit.update({
          where: { userId: user.id },
          data: { balance: { increment: creditsAmount } },
        });

        if (txn.rawPayloadRef) {
          try {
            const meta = JSON.parse(txn.rawPayloadRef) as Record<string, unknown>;
            await this.prisma.paymentTransaction.update({
              where: { id: txn.id },
              data: {
                rawPayloadRef: JSON.stringify({ ...meta, claimed: true }),
              },
            });
          } catch {
            /* non-fatal */
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
}
