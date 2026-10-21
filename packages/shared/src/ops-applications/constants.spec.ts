import { describe, expect, it } from 'vitest';
import { CREDIT_CONFIRMED_STATUSES, CREDIT_PIPELINE_STATUSES, CREDIT_REVIEW_STATUSES } from './constants';

describe('credit queue statuses', () => {
  it('keeps confirmed post-approval cases on the credit pipeline', () => {
    expect(CREDIT_REVIEW_STATUSES).toEqual(['under_review', 'resubmission_required']);
    expect(CREDIT_CONFIRMED_STATUSES).toContain('contract_signing_required');
    expect(CREDIT_CONFIRMED_STATUSES).toContain('pending_finance_activation');
    expect(CREDIT_PIPELINE_STATUSES).toEqual(
      expect.arrayContaining([...CREDIT_REVIEW_STATUSES, ...CREDIT_CONFIRMED_STATUSES]),
    );
  });
});
