import { PaymentEventType, Prisma } from '@prisma/client';

/**
 * Blox credits paid against an installment go through the payment ledger like
 * cash: a `blox_credits` payment event on the schedule and a credit-wallet
 * transaction, both carrying the same reference `CR-<creditTransactionId>` so
 * finance can reconcile the wallet debit against the schedule.
 *
 * Pure so the entry shape is unit-tested without a database.
 */

export const BLOX_CREDITS_REFERENCE_PREFIX = 'CR-';
export const BLOX_CREDITS_WALLET_ACTION = 'pay_installment';

export function bloxCreditsReference(creditTransactionId: string): string {
  return `${BLOX_CREDITS_REFERENCE_PREFIX}${creditTransactionId}`;
}

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
  /** Wallet transaction description (stored data, not UI copy). */
  description: string;
  paymentEvent: Prisma.PaymentEventUncheckedCreateInput;
};

export function buildBloxCreditsLedgerEntry(input: BloxCreditsLedgerInput): BloxCreditsLedgerEntry {
  const reference = bloxCreditsReference(input.creditTransactionId);
  const label =
    input.scheduleSequence != null ? `installment #${input.scheduleSequence}` : `schedule ${input.scheduleId}`;
  return {
    reference,
    description: `Blox credits applied to ${label} of application ${input.applicationId} (${reference})`,
    paymentEvent: {
      applicationId: input.applicationId,
      scheduleId: input.scheduleId,
      type: PaymentEventType.blox_credits,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      currency: 'QAR',
      actorUserId: input.actorUserId,
      reason: 'blox_credits',
      metadata: { reference, credits_debited: input.amount } as Prisma.InputJsonValue,
    },
  };
}
