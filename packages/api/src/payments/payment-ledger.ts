import { PaymentEventType, Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/** Event types that settle part of a schedule with value received (cash, gateway, Blox credits). */
export const CASH_LIKE_EVENT_TYPES: ReadonlySet<PaymentEventType> = new Set<PaymentEventType>([
  PaymentEventType.installment,
  PaymentEventType.down_payment,
  PaymentEventType.blox_credits,
]);

/** Derive schedule balances from append-only ledger events. */
export async function computeScheduleAmountsFromEvents(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  scheduleAmount: Prisma.Decimal,
): Promise<{ paidAmount: Prisma.Decimal; remainingAmount: Prisma.Decimal }> {
  const events = await tx.paymentEvent.findMany({
    where: { scheduleId },
    orderBy: { createdAt: 'asc' },
  });

  let cashPaid = ZERO;
  let waived = ZERO;

  for (const event of events) {
    if (CASH_LIKE_EVENT_TYPES.has(event.type)) {
      cashPaid = cashPaid.add(event.amount);
    } else if (event.type === PaymentEventType.reversal) {
      cashPaid = cashPaid.sub(event.amount);
    } else if (event.type === PaymentEventType.waive) {
      waived = waived.add(event.amount);
    }
  }

  if (waived.gt(0)) {
    // Forgiven balance counts as settled; cache keeps paid + remaining = amount.
    return { paidAmount: scheduleAmount, remainingAmount: ZERO };
  }

  let remaining = scheduleAmount.sub(cashPaid);
  if (remaining.lessThan(ZERO)) {
    remaining = ZERO;
  }

  return { paidAmount: cashPaid, remainingAmount: remaining };
}
