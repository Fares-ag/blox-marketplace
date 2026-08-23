import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyService } from '../common/idempotency.service';

const BLOX_CREDIT_QAR_VALUE = 250;

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

  async payInstallment(user: User, applicationId: string, dueDate: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('invalid_amount');
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();

    const due = new Date(dueDate);
    const schedule = await this.prisma.paymentSchedule.findFirst({
      where: { applicationId, dueDate: due },
    });
    if (!schedule) throw new NotFoundException('schedule_not_found');

    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.userCredit.findUnique({ where: { userId: user.id } });
      const balance = credit ? Number(credit.balance) : 0;
      if (balance < amount) throw new BadRequestException('insufficient_credits');

      await tx.userCredit.update({
        where: { userId: user.id },
        data: { balance: new Prisma.Decimal(balance - amount) },
      });

      const remaining = Math.max(0, Number(schedule.remainingAmount) - amount);
      const paidAmount = Number(schedule.paidAmount) + amount;
      await tx.paymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidAmount,
          remainingAmount: remaining,
          status: remaining <= 0 ? 'paid' : schedule.status,
          paidAt: remaining <= 0 ? new Date() : schedule.paidAt,
          paymentMethod: 'credits',
        },
      });

      return { ok: true, remaining, balance: balance - amount };
    });
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
