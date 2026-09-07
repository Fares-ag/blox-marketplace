import { PaymentEventType, Prisma } from '@prisma/client';
export declare const CASH_LIKE_EVENT_TYPES: ReadonlySet<PaymentEventType>;
export declare function computeScheduleAmountsFromEvents(tx: Prisma.TransactionClient, scheduleId: string, scheduleAmount: Prisma.Decimal): Promise<{
    paidAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
}>;
