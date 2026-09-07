import { describe, expect, it } from 'vitest';
import { CONSENT_CATALOG_VERSION } from '@drivemarket/shared/domain-rules';
import { BLOCKING_APPLICATION_STATUSES } from '../applications/application-access';
import { buildConsentStatus, type ConsentRecordLike } from './consent-logic';
import {
  applicationCarriesConsent,
  consentWithdrawalDecision,
  WITHDRAWAL_BLOCKING_STATUSES,
  type WithdrawalApplication,
} from './consent-withdrawal';

const STAMPED = new Date('2026-09-01T00:00:00Z');

function app(overrides: Partial<WithdrawalApplication> = {}): WithdrawalApplication {
  return { id: 'app', status: 'draft', consentsCompletedAt: null, consentCodes: [], ...overrides };
}

describe('consentWithdrawalDecision', () => {
  it('blocks on every post-submission blocking status and never on drafts', () => {
    expect(WITHDRAWAL_BLOCKING_STATUSES).not.toContain('draft');
    expect(WITHDRAWAL_BLOCKING_STATUSES).toEqual(BLOCKING_APPLICATION_STATUSES.filter((s) => s !== 'draft'));
    for (const status of WITHDRAWAL_BLOCKING_STATUSES) {
      const decision = consentWithdrawalDecision('credit_bureau', [
        app({ id: `app-${status}`, status, consentsCompletedAt: STAMPED }),
      ]);
      expect(decision.allowed).toBe(false);
      expect(decision.blockingApplicationIds).toEqual([`app-${status}`]);
    }
  });

  it('allows the withdrawal when nothing live relies on the consent', () => {
    expect(consentWithdrawalDecision('terms', [])).toEqual({
      allowed: true,
      blockingApplicationIds: [],
      draftIdsToClear: [],
    });
    // Closed applications are not in the blocking list at all, so they never reach the decision.
    const decision = consentWithdrawalDecision('terms', [
      app({ id: 'unstamped', status: 'under_review', consentsCompletedAt: null, consentCodes: [] }),
    ]);
    expect(decision.allowed).toBe(true);
  });

  it('clears the stamp on drafts that carried the consent and leaves other drafts alone', () => {
    const decision = consentWithdrawalDecision('aml', [
      app({ id: 'd1', status: 'draft', consentsCompletedAt: STAMPED }),
      app({ id: 'd2', status: 'draft', consentCodes: ['aml'] }),
      app({ id: 'd3', status: 'draft', consentCodes: ['terms'] }),
    ]);
    expect(decision).toEqual({ allowed: true, blockingApplicationIds: [], draftIdsToClear: ['d1', 'd2'] });
  });

  it('reports both the blockers and the drafts to clear in one decision', () => {
    const decision = consentWithdrawalDecision('credit_bureau', [
      app({ id: 'live', status: 'active', consentsCompletedAt: STAMPED }),
      app({ id: 'draft', status: 'draft', consentsCompletedAt: STAMPED }),
      app({ id: 'linked', status: 'contract_signing_required', consentCodes: ['credit_bureau'] }),
    ]);
    expect(decision.allowed).toBe(false);
    expect(decision.blockingApplicationIds).toEqual(['live', 'linked']);
    expect(decision.draftIdsToClear).toEqual(['draft']);
  });

  it('an application carries a consent when stamped or when the code is linked to it', () => {
    expect(applicationCarriesConsent(app({ consentsCompletedAt: STAMPED }), 'terms')).toBe(true);
    expect(applicationCarriesConsent(app({ consentCodes: ['terms'] }), 'terms')).toBe(true);
    expect(applicationCarriesConsent(app({ consentCodes: ['aml'] }), 'terms')).toBe(false);
  });
});

describe('buildConsentStatus with withdrawals', () => {
  function record(code: string, overrides: Partial<ConsentRecordLike> = {}): ConsentRecordLike {
    return {
      id: `rec-${code}`,
      code,
      version: CONSENT_CATALOG_VERSION,
      locale: 'en',
      channel: 'web',
      acceptedAt: new Date('2026-09-01T10:00:00Z'),
      applicationId: null,
      actor: null,
      ...overrides,
    };
  }

  it('a withdrawn acceptance leaves `accepted`, reopens `missing` and is listed under `withdrawn`', () => {
    const withdrawnAt = new Date('2026-09-05T10:00:00Z');
    const status = buildConsentStatus([
      record('credit_bureau', { withdrawnAt }),
      record('terms'),
      record('kyc_biometric'),
      record('aml'),
    ]);
    expect(status.complete).toBe(false);
    expect(status.missing).toEqual(['credit_bureau']);
    expect(status.accepted.map((r) => r.code)).toEqual(['terms', 'kyc_biometric', 'aml']);
    expect(status.accepted.every((r) => r.withdrawn_at === null)).toBe(true);
    expect(status.withdrawn?.map((r) => [r.code, r.withdrawn_at])).toEqual([
      ['credit_bureau', withdrawnAt.toISOString()],
    ]);
  });

  it('a fresh acceptance after a withdrawal makes the consent complete again and keeps the history', () => {
    const status = buildConsentStatus([
      record('credit_bureau', { id: 'old', withdrawnAt: new Date('2026-09-05T10:00:00Z') }),
      record('credit_bureau', { id: 'new', acceptedAt: new Date('2026-09-06T10:00:00Z') }),
      record('terms'),
      record('kyc_biometric'),
      record('aml'),
    ]);
    expect(status.complete).toBe(true);
    expect(status.accepted.find((r) => r.code === 'credit_bureau')?.id).toBe('new');
    expect(status.withdrawn).toHaveLength(1);
  });
});
