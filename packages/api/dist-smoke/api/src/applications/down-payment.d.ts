import { Prisma } from '@prisma/client';
export declare function requiredDownPaymentAmount(pricingSnapshot: Record<string, unknown>): Prisma.Decimal;
export declare function sumDownPaymentRecorded(db: Prisma.TransactionClient | {
    paymentEvent: Prisma.TransactionClient['paymentEvent'];
}, applicationId: string): Promise<Prisma.Decimal>;
export declare function assertDownPaymentSatisfied(required: Prisma.Decimal, recorded: Prisma.Decimal): void;
export declare function assertDownPaymentRecordedForDirectActivation(db: Prisma.TransactionClient | {
    paymentEvent: Prisma.TransactionClient['paymentEvent'];
}, applicationId: string, pricingSnapshot: Record<string, unknown>): Promise<void>;
