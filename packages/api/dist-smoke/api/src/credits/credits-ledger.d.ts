import { Prisma } from '@prisma/client';
export declare const BLOX_CREDITS_REFERENCE_PREFIX = "CR-";
export declare const BLOX_CREDITS_WALLET_ACTION = "pay_installment";
export declare function bloxCreditsReference(creditTransactionId: string): string;
export type BloxCreditsLedgerInput = {
    creditTransactionId: string;
    amount: number;
    applicationId: string;
    scheduleId: string;
    scheduleSequence?: number | null;
    actorUserId: string;
};
export type BloxCreditsLedgerEntry = {
    reference: string;
    description: string;
    paymentEvent: Prisma.PaymentEventUncheckedCreateInput;
};
export declare function buildBloxCreditsLedgerEntry(input: BloxCreditsLedgerInput): BloxCreditsLedgerEntry;
