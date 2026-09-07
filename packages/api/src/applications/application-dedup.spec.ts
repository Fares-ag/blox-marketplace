import { describe, expect, it } from 'vitest';
import {
  ACTIVE_BLOCKING_APPLICATION_STATUSES,
  decideDuplicateApplication,
  decideIdentityHold,
  summarizeBlocking,
  type DedupCandidate,
} from './application-dedup';

function candidate(
  id: string,
  status: DedupCandidate['status'],
  productId: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): DedupCandidate {
  return { id, status, productId, createdAt: new Date(createdAt) };
}

describe('decideDuplicateApplication', () => {
  it('creates when the customer has no application in flight', () => {
    expect(decideDuplicateApplication([], 'prod-1')).toEqual({ kind: 'create' });
  });

  it('resumes an existing draft for the same vehicle', () => {
    const decision = decideDuplicateApplication([candidate('app-1', 'draft', 'prod-1')], 'prod-1');
    expect(decision).toEqual({ kind: 'resume', applicationId: 'app-1' });
  });

  it('does not treat a draft on another vehicle as blocking', () => {
    expect(decideDuplicateApplication([candidate('app-1', 'draft', 'prod-2')], 'prod-1')).toEqual({
      kind: 'create',
    });
  });

  it('blocks when an application is in flight, whatever the vehicle', () => {
    const decision = decideDuplicateApplication([candidate('app-1', 'under_review', 'prod-2')], 'prod-1');
    expect(decision).toEqual({ kind: 'blocked', applicationId: 'app-1', status: 'under_review' });
  });

  it('prefers the block over resuming a stale draft', () => {
    const decision = decideDuplicateApplication(
      [candidate('draft-1', 'draft', 'prod-1'), candidate('active-1', 'active', 'prod-2')],
      'prod-1',
    );
    expect(decision).toEqual({ kind: 'blocked', applicationId: 'active-1', status: 'active' });
  });

  it('picks the newest blocking application and the newest same-product draft', () => {
    const blocked = decideDuplicateApplication(
      [
        candidate('old', 'resubmission_required', 'prod-1', '2026-01-01T00:00:00.000Z'),
        candidate('new', 'partner_processing', 'prod-1', '2026-02-01T00:00:00.000Z'),
      ],
      'prod-1',
    );
    expect(blocked).toMatchObject({ kind: 'blocked', applicationId: 'new' });

    const resumed = decideDuplicateApplication(
      [
        candidate('old-draft', 'draft', 'prod-1', '2026-01-01T00:00:00.000Z'),
        candidate('new-draft', 'draft', 'prod-1', '2026-03-01T00:00:00.000Z'),
      ],
      'prod-1',
    );
    expect(resumed).toEqual({ kind: 'resume', applicationId: 'new-draft' });
  });

  it('never counts draft among the actively blocking statuses', () => {
    expect(ACTIVE_BLOCKING_APPLICATION_STATUSES).not.toContain('draft');
    expect(ACTIVE_BLOCKING_APPLICATION_STATUSES).toEqual(
      expect.arrayContaining(['under_review', 'partner_processing', 'active', 'contract_signing_required']),
    );
  });
});

describe('summarizeBlocking', () => {
  it('reports the in-flight application and the resumable draft', () => {
    const summary = summarizeBlocking(
      [candidate('draft-1', 'draft', 'prod-1'), candidate('active-1', 'active', 'prod-2')],
      'prod-1',
    );
    expect(summary).toEqual({
      blocking: true,
      applicationId: 'active-1',
      status: 'active',
      draftApplicationId: 'draft-1',
    });
  });

  it('is not blocking for drafts only and scopes the draft to the product when given', () => {
    const rows = [candidate('draft-2', 'draft', 'prod-2')];
    expect(summarizeBlocking(rows, 'prod-1')).toEqual({
      blocking: false,
      applicationId: null,
      status: null,
      draftApplicationId: null,
    });
    expect(summarizeBlocking(rows)).toMatchObject({ blocking: false, draftApplicationId: 'draft-2' });
  });
});

describe('decideIdentityHold', () => {
  const subject = { userId: 'me', name: 'Mohammed Al-Thani', birthYear: 1985 };

  it('does not hold when nobody else carries the QID', () => {
    expect(decideIdentityHold(subject, [])).toBeNull();
  });

  it('ignores the subject account itself', () => {
    expect(decideIdentityHold(subject, [{ userId: 'me', name: 'Someone Else', birthYear: 1970 }])).toBeNull();
  });

  it('accepts the same person under a different account (name folded, birth year compatible)', () => {
    expect(
      decideIdentityHold(subject, [
        { userId: 'walk-in', name: '  mohammed   al thani ', birthYear: null, source: 'user' },
        { userId: 'other-app', name: 'MOHAMMED AL-THANI', birthYear: 1985, source: 'application' },
      ]),
    ).toBeNull();
  });

  it('holds on a different name', () => {
    const decision = decideIdentityHold(subject, [{ userId: 'u2', name: 'Fatima Hassan', birthYear: 1985 }]);
    expect(decision).toEqual({
      reason: 'qid_identity_mismatch',
      conflicts: [{ userId: 'u2', source: 'user', nameMismatch: true, birthYearMismatch: false }],
    });
  });

  it('holds on a different birth year even when the name matches', () => {
    const decision = decideIdentityHold(subject, [
      { userId: 'u2', name: 'Mohammed Al-Thani', birthYear: 1990, source: 'application' },
    ]);
    expect(decision?.conflicts).toEqual([
      { userId: 'u2', source: 'application', nameMismatch: false, birthYearMismatch: true },
    ]);
  });

  it('lists only the conflicting matches', () => {
    const decision = decideIdentityHold(subject, [
      { userId: 'same', name: 'Mohammed Al Thani', birthYear: 1985 },
      { userId: 'different', name: 'Ali Khan', birthYear: 1985 },
    ]);
    expect(decision?.conflicts.map((c) => c.userId)).toEqual(['different']);
  });
});
