import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentEventType, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CreditsService } from './credits.service';

/**
 * `payInstallment` must debit the wallet, write the wallet transaction and the
 * `blox_credits` payment event in ONE transaction, and hand the shared
 * reference back — exercised against a hand-rolled Prisma double.
 */
function harness(opts: { balance?: number; schedule?: Record<string, unknown> } = {}) {
  const schedule = {
    id: 'sched_1',
    applicationId: 'app_1',
    sequence: 4,
    dueDate: new Date('2026-05-01T00:00:00.000Z'),
    amount: new Prisma.Decimal('2500.00'),
    paidAmount: new Prisma.Decimal('0.00'),
    remainingAmount: new Prisma.Decimal('2500.00'),
    status: 'pending',
    paidAt: null,
    ...(opts.schedule ?? {}),
  };
  const tx = {
    userCredit: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'user_1', balance: new Prisma.Decimal(opts.balance ?? 1000) }),
      update: vi.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      create: vi.fn().mockResolvedValue({ id: 'ct_abc' }),
      update: vi.fn().mockResolvedValue({}),
    },
    paymentEvent: { create: vi.fn().mockResolvedValue({ id: 'evt_1' }) },
    paymentSchedule: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    application: { findUnique: vi.fn().mockResolvedValue({ id: 'app_1', customerUserId: 'user_1' }) },
    paymentSchedule: { findFirst: vi.fn().mockResolvedValue(schedule) },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new CreditsService(prisma as never, {} as never);
  const user = { id: 'user_1', role: 'customer' } as never;
  return { service, prisma, tx, user };
}

describe('CreditsService.payInstallment', () => {
  it('writes the wallet transaction and the blox_credits event together and returns the reference', async () => {
    const { service, prisma, tx, user } = harness();
    const result = await service.payInstallment(user, 'app_1', '2026-05-01', 250);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      remaining: 2250,
      balance: 750,
      reference: 'CR-ct_abc',
      credit_transaction_id: 'ct_abc',
      credits_debited: 250,
    });

    expect(tx.userCredit.update).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { balance: new Prisma.Decimal(750) },
    });
    const wallet = tx.creditTransaction.create.mock.calls[0][0].data;
    expect(wallet).toMatchObject({ userId: 'user_1', action: 'pay_installment', actorUserId: 'user_1' });
    expect(String(wallet.amount)).toBe('250');
    expect(String(wallet.balanceAfter)).toBe('750');
    expect(tx.creditTransaction.update).toHaveBeenCalledWith({
      where: { id: 'ct_abc' },
      data: { description: expect.stringContaining('CR-ct_abc') },
    });

    const event = tx.paymentEvent.create.mock.calls[0][0].data;
    expect(event).toMatchObject({
      applicationId: 'app_1',
      scheduleId: 'sched_1',
      type: PaymentEventType.blox_credits,
      actorUserId: 'user_1',
      reason: 'blox_credits',
      metadata: { reference: 'CR-ct_abc', credits_debited: 250 },
    });
    expect(event.amount.toFixed(2)).toBe('250.00');

    expect(tx.paymentSchedule.update).toHaveBeenCalledWith({
      where: { id: 'sched_1' },
      data: expect.objectContaining({
        paidAmount: 250,
        remainingAmount: 2250,
        status: 'pending',
        paymentMethod: 'credits',
        paymentReference: 'CR-ct_abc',
      }),
    });
  });

  it('marks the schedule paid when the credits cover the remainder', async () => {
    const { service, tx, user } = harness({ balance: 5000 });
    const result = await service.payInstallment(user, 'app_1', '2026-05-01', 2500);
    expect(result.remaining).toBe(0);
    expect(tx.paymentSchedule.update.mock.calls[0][0].data).toMatchObject({ status: 'paid', remainingAmount: 0 });
    expect(tx.paymentSchedule.update.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);
  });

  it('refuses when the wallet cannot cover the amount, leaving no ledger rows', async () => {
    const { service, tx, user } = harness({ balance: 100 });
    await expect(service.payInstallment(user, 'app_1', '2026-05-01', 250)).rejects.toThrow(BadRequestException);
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('refuses a settled schedule and a settle-all request before touching the wallet', async () => {
    const paid = harness({ schedule: { status: 'paid', remainingAmount: new Prisma.Decimal(0) } });
    await expect(paid.service.payInstallment(paid.user, 'app_1', '2026-05-01', 10)).rejects.toThrow('schedule_already_settled');

    const sweep = harness();
    await expect(sweep.service.payInstallment(sweep.user, 'app_1', 'settlement', 10_000)).rejects.toThrow(ConflictException);
    expect(sweep.prisma.application.findUnique).not.toHaveBeenCalled();
    expect(sweep.prisma.$transaction).not.toHaveBeenCalled();
  });
});
