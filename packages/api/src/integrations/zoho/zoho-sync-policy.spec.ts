import { describe, expect, it } from 'vitest';
import { shouldSyncStatusToCrm } from './zoho-sync-policy';

describe('shouldSyncStatusToCrm', () => {
  it('does not push unsubmitted drafts to the partner CRM (Z3)', () => {
    expect(shouldSyncStatusToCrm('draft')).toBe(false);
  });

  it('pushes submitted applications', () => {
    expect(shouldSyncStatusToCrm('under_review')).toBe(true);
  });

  it('pushes resubmissions so the partner receives the new documents', () => {
    expect(shouldSyncStatusToCrm('resubmission_required')).toBe(true);
  });

  it('pushes later lifecycle states', () => {
    for (const status of [
      'contract_signing_required',
      'contracts_submitted',
      'contract_under_review',
      'down_payment_required',
      'down_payment_submitted',
      'pending_finance_activation',
      'active',
      'completed',
      'rejected',
    ] as const) {
      expect(shouldSyncStatusToCrm(status)).toBe(true);
    }
  });
});
