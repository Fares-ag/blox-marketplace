import { describe, expect, it } from 'vitest';
import { downPaymentCollectedForOps } from './down-payment-ui';

describe('downPaymentCollectedForOps', () => {
  it('returns false when no down payment is required', () => {
    expect(
      downPaymentCollectedForOps({
        pricing_snapshot: { down_payment: 0 },
        activity_logs: [{ id: '1', action: 'down_payment_recorded', from_value: null, to_value: null, actor_email: null, created_at: '' }],
      }),
    ).toBe(false);
  });

  it('returns true when required down payment was recorded', () => {
    expect(
      downPaymentCollectedForOps({
        pricing_snapshot: { down_payment: 20_000 },
        activity_logs: [{ id: '1', action: 'down_payment_recorded', from_value: null, to_value: null, actor_email: null, created_at: '' }],
      }),
    ).toBe(true);
  });

  it('prefers the ledger flag from the ops DTO', () => {
    expect(
      downPaymentCollectedForOps({
        pricing_snapshot: { down_payment: 20_000 },
        down_payment_collected: true,
        activity_logs: [],
      }),
    ).toBe(true);
    expect(
      downPaymentCollectedForOps({
        pricing_snapshot: { down_payment: 20_000 },
        down_payment_collected: false,
        activity_logs: [{ id: '1', action: 'down_payment_recorded', from_value: null, to_value: null, actor_email: null, created_at: '' }],
      }),
    ).toBe(false);
  });

  it('uses recorded vs required amounts when the flag is absent', () => {
    expect(
      downPaymentCollectedForOps({
        pricing_snapshot: { down_payment: 20_000 },
        down_payment_required: 20_000,
        down_payment_recorded: 20_000,
        activity_logs: [],
      }),
    ).toBe(true);
  });
});
