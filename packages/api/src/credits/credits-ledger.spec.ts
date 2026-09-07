import { PaymentEventType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  BLOX_CREDITS_WALLET_ACTION,
  bloxCreditsReference,
  buildBloxCreditsLedgerEntry,
} from './credits-ledger';

describe('Blox credits ledger entry', () => {
  it('derives the reference from the wallet transaction id', () => {
    expect(bloxCreditsReference('ct_123')).toBe('CR-ct_123');
    expect(BLOX_CREDITS_WALLET_ACTION).toBe('pay_installment');
  });

  it('builds a blox_credits payment event carrying the shared reference', () => {
    const entry = buildBloxCreditsLedgerEntry({
      creditTransactionId: 'ct_123',
      amount: 250,
      applicationId: 'app_1',
      scheduleId: 'sched_3',
      scheduleSequence: 3,
      actorUserId: 'user_1',
    });
    expect(entry.reference).toBe('CR-ct_123');
    expect(entry.description).toContain('installment #3');
    expect(entry.description).toContain('CR-ct_123');
    expect(entry.paymentEvent).toMatchObject({
      applicationId: 'app_1',
      scheduleId: 'sched_3',
      type: PaymentEventType.blox_credits,
      currency: 'QAR',
      actorUserId: 'user_1',
      reason: 'blox_credits',
      metadata: { reference: 'CR-ct_123', credits_debited: 250 },
    });
    expect((entry.paymentEvent.amount as { toFixed(n: number): string }).toFixed(2)).toBe('250.00');
  });

  it('falls back to the schedule id when the sequence is unknown', () => {
    const entry = buildBloxCreditsLedgerEntry({
      creditTransactionId: 'ct_9',
      amount: 12.345,
      applicationId: 'app_1',
      scheduleId: 'sched_9',
      actorUserId: 'user_1',
    });
    expect(entry.description).toContain('schedule sched_9');
    expect((entry.paymentEvent.amount as { toFixed(n: number): string }).toFixed(2)).toBe('12.35');
  });
});
