import { PaymentEventType, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { computeScheduleAmountsFromEvents } from './payment-ledger';

describe('computeScheduleAmountsFromEvents', () => {
  const scheduleAmount = new Prisma.Decimal('2500.00');

  function mockTx(events: Array<{ type: PaymentEventType; amount: Prisma.Decimal | number | string }>) {
    return {
      paymentEvent: {
        findMany: vi.fn().mockResolvedValue(
          events.map((event, index) => ({
            id: `evt-${index}`,
            type: event.type,
            amount: new Prisma.Decimal(event.amount),
            createdAt: new Date(Date.now() + index),
          })),
        ),
      },
    };
  }

  it('derives paid and remaining from installment events only', async () => {
    const ledger = await computeScheduleAmountsFromEvents(
      mockTx([{ type: PaymentEventType.installment, amount: '1000.00' }]) as never,
      'sched-1',
      scheduleAmount,
    );

    expect(ledger.paidAmount.toFixed(2)).toBe('1000.00');
    expect(ledger.remainingAmount.toFixed(2)).toBe('1500.00');
  });

  it('treats waived balance as fully settled so paid + remaining = amount', async () => {
    const ledger = await computeScheduleAmountsFromEvents(
      mockTx([
        { type: PaymentEventType.installment, amount: '500.00' },
        { type: PaymentEventType.waive, amount: '2000.00' },
      ]) as never,
      'sched-1',
      scheduleAmount,
    );

    expect(ledger.paidAmount.toFixed(2)).toBe('2500.00');
    expect(ledger.remainingAmount.toFixed(2)).toBe('0.00');
    expect(ledger.paidAmount.add(ledger.remainingAmount).eq(scheduleAmount)).toBe(true);
  });

  it('treats a full waive on a pending schedule as paidAmount = amount', async () => {
    const ledger = await computeScheduleAmountsFromEvents(
      mockTx([{ type: PaymentEventType.waive, amount: '2500.00' }]) as never,
      'sched-1',
      scheduleAmount,
    );

    expect(ledger.paidAmount.toFixed(2)).toBe('2500.00');
    expect(ledger.remainingAmount.toFixed(2)).toBe('0.00');
  });
});
