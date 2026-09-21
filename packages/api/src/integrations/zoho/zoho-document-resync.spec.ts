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
 *
 * The re-sync is attach-only (`updateLeadFields: false`): it must not PUT the
 * lead record. A PUT after create is what made Al Jazeera list a brand-new
 * dealer application as a modified prospect rather than a new one.
 */

// Mirrors the guards in applications.service.uploadDoc (customer) and
// applications-staff.service.uploadDoc (dealer/ops).
const CUSTOMER_UPLOAD_STATES = ['draft', 'resubmission_required'] as const;
const STAFF_UPLOAD_STATES = [
  'draft',
  'under_review',
  'partner_processing',
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

  it('covers under_review — the walk-in wizard case for a Blox-financed deal', () => {
    expect(shouldSyncStatusToCrm('under_review' as never)).toBe(true);
  });

  it('covers partner_processing — the status every Al Jazeera application sits in', () => {
    // submittedStatusForPartner() puts a partner-financed application straight
    // into partner_processing on submit. The dealer wizard creates with
    // submit: true and uploads documents AFTERWARDS, so this is the status the
    // uploads actually happen in. It was missing from the staff upload guard,
    // which rejected every one of those uploads with 400 validation_failed —
    // a partner-financed application could not carry a single document.
    expect(shouldSyncStatusToCrm('partner_processing' as never)).toBe(true);
  });
});
