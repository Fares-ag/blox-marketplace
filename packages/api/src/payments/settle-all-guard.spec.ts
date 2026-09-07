import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertNotSettleAll, isSettleAllRequest } from './settle-all-guard';

describe('settle-all guard', () => {
  it('recognises the mobile settlement checkout by its schedule marker', () => {
    expect(isSettleAllRequest({ scheduleId: 'settlement' })).toBe(true);
    expect(isSettleAllRequest({ scheduleId: ' Settlement ' })).toBe(true);
    expect(isSettleAllRequest({ scheduleId: 'settle-all' })).toBe(true);
    expect(isSettleAllRequest({ scheduleId: 'clx_sched_1' })).toBe(false);
  });

  it('recognises the settlement flags in the gateway metadata', () => {
    const custom1 = JSON.stringify({
      type: 'settlement_payment',
      applicationId: 'app_1',
      scheduleItemId: 'settlement',
      dueDate: 'settlement',
      isSettlement: true,
    });
    expect(isSettleAllRequest({ scheduleId: 'clx_sched_1', custom1 })).toBe(true);
    expect(isSettleAllRequest({ custom1: JSON.stringify({ isSettlement: true }) })).toBe(true);
    expect(isSettleAllRequest({ custom1: JSON.stringify({ type: 'installment_payment', isSettlement: false }) })).toBe(
      false,
    );
    expect(isSettleAllRequest({ custom1: 'not json' })).toBe(false);
    expect(isSettleAllRequest({ custom1: '' })).toBe(false);
  });

  it('recognises a credits payment addressed to the whole remainder', () => {
    expect(isSettleAllRequest({ dueDate: 'settlement' })).toBe(true);
    expect(isSettleAllRequest({ dueDate: '2026-05-01' })).toBe(false);
  });

  it('throws 409 settlement_quote_required and passes single installments through', () => {
    try {
      assertNotSettleAll({ scheduleId: 'settlement' });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe('settlement_quote_required');
    }
    expect(() => assertNotSettleAll({ scheduleId: 'clx_sched_1', dueDate: '2026-05-01' })).not.toThrow();
  });
});
