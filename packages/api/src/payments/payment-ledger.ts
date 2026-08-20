import { PaymentEventType, Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

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
    if (
      event.type === PaymentEventType.installment ||
      event.type === PaymentEventType.down_payment
    ) {
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
