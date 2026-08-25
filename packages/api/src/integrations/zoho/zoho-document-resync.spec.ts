import { describe, expect, it } from 'vitest';
import { shouldSyncStatusToCrm } from './zoho-sync-policy';

/**
 * Guards the fault that left Al Jazeera leads showing "No Attachment".
 *
 * The walk-in/dealer path creates an application and syncs it to the partner
 * CRM immediately. The wizard uploads the documents AFTERWARDS, as separate
 * requests. Because neither upload path re-synced, the lead was created with
 * nothing attached and nothing ever re-sent it — the documents existed in our
 * database and never reached the partner.
 *
 * Both uploadDoc paths now re-sync, gated on this policy. These cases pin the
 * gate: the states a document can be uploaded in must be states that sync,
 * otherwise the re-sync is dead code and the bug returns silently.
 */

// Mirrors the guards in applications.service.uploadDoc (customer) and
// applications-staff.service.uploadDoc (dealer/ops).
const CUSTOMER_UPLOAD_STATES = ['draft', 'resubmission_required'] as const;
const STAFF_UPLOAD_STATES = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
] as const;

describe('document upload re-sync', () => {
  it('re-syncs for every staff upload state except draft', () => {
    for (const status of STAFF_UPLOAD_STATES) {
      const expected = status !== 'draft';
      expect(
        shouldSyncStatusToCrm(status as never),
        `a document uploaded while ${status} must ${expected ? '' : 'not '}reach the partner`,
      ).toBe(expected);
    }
  });

  it('re-syncs a resubmitted document — the case the partner is waiting on', () => {
    // resubmission_required means the lead already exists and the partner asked
    // for these files specifically. If this ever returns false the documents
    // stop arriving and nothing reports an error.
    expect(shouldSyncStatusToCrm('resubmission_required' as never)).toBe(true);
  });

  it('does not sync while still a draft', () => {
    // No lead exists yet; the submit itself performs the first sync, so
    // syncing per file here would create a lead for an application the
    // customer may never submit.
    for (const status of CUSTOMER_UPLOAD_STATES) {
      if (status === 'draft') expect(shouldSyncStatusToCrm(status as never)).toBe(false);
    }
  });

  it('covers under_review — the walk-in wizard case that lost attachments', () => {
    // The dealer wizard creates at under_review, syncs, THEN uploads. This is
    // the exact state the lost documents were uploaded in.
    expect(shouldSyncStatusToCrm('under_review' as never)).toBe(true);
  });
});
