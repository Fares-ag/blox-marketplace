import { BadRequestException } from '@nestjs/common';
import { PaymentEventType, Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/** Required down payment from the server-side pricing snapshot (never client input). */
export function requiredDownPaymentAmount(pricingSnapshot: Record<string, unknown>): Prisma.Decimal {
  const fromSnapshot = pricingSnapshot.down_payment;
  if (fromSnapshot != null && Number.isFinite(Number(fromSnapshot))) {
    return new Prisma.Decimal(String(fromSnapshot));
  }
  const listPrice = Number(pricingSnapshot.list_price ?? 0);
  const pct = Number(pricingSnapshot.down_payment_pct ?? 0);
  if (!Number.isFinite(listPrice) || !Number.isFinite(pct)) {
    return ZERO;
  }
  return new Prisma.Decimal(listPrice).mul(pct).div(100);
}

/** Sum recorded down_payment ledger events for an application. */
export async function sumDownPaymentRecorded(
  db: Prisma.TransactionClient | { paymentEvent: Prisma.TransactionClient['paymentEvent'] },
  applicationId: string,
): Promise<Prisma.Decimal> {
  const events = await db.paymentEvent.findMany({
    where: { applicationId, type: PaymentEventType.down_payment },
    select: { amount: true },
  });
  return events.reduce((total, event) => total.add(event.amount), ZERO);
}

export function assertDownPaymentSatisfied(
  required: Prisma.Decimal,
  recorded: Prisma.Decimal,
): void {
  if (recorded.gte(required)) return;
  throw new BadRequestException('down_payment_incomplete');
}
