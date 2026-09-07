import { describe, expect, it } from 'vitest';
import { DataRightsRequestKind, DataRightsRequestStatus } from '@prisma/client';
import { BLOCKING_APPLICATION_STATUSES } from '../applications/application-access';
import {
  ANONYMISED_NAME,
  anonymisationPatch,
  anonymisedEmail,
  canTransitionDataRights,
  DATA_RIGHTS_SLA_DAYS,
  dataRightsDueAt,
  DELETION_BLOCKING_STATUSES,
  isTerminalDataRightsStatus,
  PENDING_DATA_RIGHTS_STATUSES,
  toDataRightsRequestDto,
} from './data-rights-logic';

const NOW = new Date('2026-09-07T10:00:00Z');

describe('deadlines and blocking', () => {
  it('gives the privacy team 30 days', () => {
    expect(DATA_RIGHTS_SLA_DAYS).toBe(30);
    expect(dataRightsDueAt(NOW).toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });

  it('deletion is blocked by any live post-submission application, never by a draft', () => {
    expect(DELETION_BLOCKING_STATUSES).not.toContain('draft');
    expect(DELETION_BLOCKING_STATUSES).toEqual(BLOCKING_APPLICATION_STATUSES.filter((s) => s !== 'draft'));
    expect(DELETION_BLOCKING_STATUSES).toContain('active');
    expect(DELETION_BLOCKING_STATUSES).toContain('under_review');
    expect(DELETION_BLOCKING_STATUSES).not.toContain('completed');
    expect(DELETION_BLOCKING_STATUSES).not.toContain('rejected');
  });
});

describe('status machine', () => {
  it('open → in_progress|completed|rejected, in_progress → completed|rejected, terminal states are final', () => {
    expect(canTransitionDataRights('open', 'in_progress')).toBe(true);
    expect(canTransitionDataRights('open', 'completed')).toBe(true);
    expect(canTransitionDataRights('open', 'rejected')).toBe(true);
    expect(canTransitionDataRights('in_progress', 'completed')).toBe(true);
    expect(canTransitionDataRights('in_progress', 'open')).toBe(false);
    expect(canTransitionDataRights('completed', 'in_progress')).toBe(false);
    expect(canTransitionDataRights('rejected', 'completed')).toBe(false);
    expect(canTransitionDataRights('open', 'open')).toBe(false);
    expect(isTerminalDataRightsStatus('completed')).toBe(true);
    expect(isTerminalDataRightsStatus('rejected')).toBe(true);
    expect(isTerminalDataRightsStatus('in_progress')).toBe(false);
    expect(PENDING_DATA_RIGHTS_STATUSES).toEqual(['open', 'in_progress']);
  });
});

describe('anonymisation', () => {
  it('strips every identity field, deactivates the account and gives it a synthetic email', () => {
    const patch = anonymisationPatch('usr_1');
    expect(patch).toEqual({
      name: ANONYMISED_NAME,
      email: 'deleted-usr_1@anonymised.local',
      emailVerified: false,
      image: null,
      phone: null,
      firstName: null,
      lastName: null,
      gender: null,
      dateOfBirth: null,
      nationality: null,
      isActive: false,
      twoFactorEnabled: false,
    });
    expect(anonymisedEmail('abc')).toBe('deleted-abc@anonymised.local');
    // QID columns are deliberately not part of the scalar patch: IdentityService owns them.
    expect(patch).not.toHaveProperty('qid');
    expect(patch).not.toHaveProperty('qidHash');
  });
});

describe('toDataRightsRequestDto', () => {
  const row = {
    id: 'req_1',
    userId: 'usr_1',
    kind: DataRightsRequestKind.consent_withdrawal,
    status: DataRightsRequestStatus.in_progress,
    details: 'Please stop the bureau checks',
    consentCode: 'credit_bureau' as const,
    resolutionNote: null,
    handledById: 'adm_1',
    handledAt: null,
    dueAt: new Date('2026-10-07T10:00:00Z'),
    createdAt: NOW,
    updatedAt: NOW,
    handledBy: { name: 'Privacy Officer' },
    user: { id: 'usr_1', name: 'Aisha', email: 'aisha@example.com' },
  };

  it('maps the wire shape and only embeds the customer for ops', () => {
    expect(toDataRightsRequestDto(row)).toEqual({
      id: 'req_1',
      kind: 'consent_withdrawal',
      status: 'in_progress',
      details: 'Please stop the bureau checks',
      consent_code: 'credit_bureau',
      resolution_note: null,
      due_at: '2026-10-07T10:00:00.000Z',
      handled_at: null,
      handled_by_name: 'Privacy Officer',
      created_at: NOW.toISOString(),
    });
    expect(toDataRightsRequestDto(row, { includeCustomer: true }).customer).toEqual({
      id: 'usr_1',
      name: 'Aisha',
      email: 'aisha@example.com',
    });
    expect(toDataRightsRequestDto({ ...row, handledBy: null, user: null }, { includeCustomer: true })).toMatchObject({
      handled_by_name: null,
      customer: null,
    });
  });
});
