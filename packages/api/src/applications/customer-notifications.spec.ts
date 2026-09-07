import { describe, expect, it } from 'vitest';
import { customerNotificationBody } from './customer-notifications';

describe('customerNotificationBody', () => {
  it('never carries the reason on a rejection or an ops cancellation', () => {
    expect(customerNotificationBody('rejected', 'DBR above cap, income unverifiable')).toBeUndefined();
    expect(customerNotificationBody('submission_cancelled', 'duplicate application')).toBeUndefined();
  });

  it('keeps the instruction on resubmission and re-signing requests', () => {
    expect(customerNotificationBody('resubmission_required', ' Upload a recent salary certificate ')).toBe(
      'Upload a recent salary certificate',
    );
    expect(customerNotificationBody('contract_signing_required', 'Initial every page')).toBe('Initial every page');
  });

  it('drops blank reasons', () => {
    expect(customerNotificationBody('pending_finance_activation', '   ')).toBeUndefined();
    expect(customerNotificationBody('under_review', null)).toBeUndefined();
  });
});
