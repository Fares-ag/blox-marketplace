import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_CATALOG, CONSENT_CATALOG_VERSION, consentFullText } from '@drivemarket/shared/domain-rules';
import {
  buildConsentStatus,
  consentChannelFromHeader,
  consentOutdated,
  consentTextHash,
  normalizeConsentLocale,
  validateAcceptances,
  type ConsentRecordLike,
} from './consent-logic';

const CURRENT = CONSENT_CATALOG_VERSION;
const ALL_CODES = ['credit_bureau', 'terms', 'kyc_biometric', 'aml'] as const;

function record(
  code: string,
  version: string = CURRENT,
  overrides: Partial<ConsentRecordLike> = {},
): ConsentRecordLike {
  return {
    id: `rec-${code}-${version}`,
    code,
    version,
    locale: 'en',
    channel: 'web',
    acceptedAt: new Date('2026-09-01T10:00:00Z'),
    applicationId: null,
    actor: null,
    ...overrides,
  };
}

describe('validateAcceptances', () => {
  it('accepts the four current-version consents and collapses duplicates', () => {
    const result = validateAcceptances([
      ...ALL_CODES.map((code) => ({ code, version: CURRENT })),
      { code: 'terms', version: CURRENT },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accepted.map((a) => a.code)).toEqual([...ALL_CODES]);
    expect(result.accepted.every((a) => a.version === CONSENT_CATALOG[a.code].version)).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(validateAcceptances([{ code: 'marketing', version: CURRENT }])).toEqual({
      ok: false,
      error: 'consent_code_invalid',
      code: 'marketing',
    });
  });

  it('rejects a version that is not the current catalog version', () => {
    expect(validateAcceptances([{ code: 'terms', version: '2025-01-v1' }])).toEqual({
      ok: false,
      error: 'consent_version_outdated',
      code: 'terms',
    });
    expect(validateAcceptances([{ code: 'aml', version: ` ${CURRENT} ` }]).ok).toBe(true);
  });

  it('returns an empty acceptance list for an empty request', () => {
    expect(validateAcceptances([])).toEqual({ ok: true, accepted: [] });
  });
});

describe('buildConsentStatus', () => {
  it('reports everything missing when nothing was accepted', () => {
    const status = buildConsentStatus([]);
    expect(status.catalog_version).toBe(CURRENT);
    expect(status.required).toEqual([...ALL_CODES]);
    expect(status.missing).toEqual([...ALL_CODES]);
    expect(status.accepted).toEqual([]);
    expect(status.complete).toBe(false);
  });

  it('is complete once every code is accepted at the current version', () => {
    const status = buildConsentStatus(ALL_CODES.map((code) => record(code)));
    expect(status.missing).toEqual([]);
    expect(status.complete).toBe(true);
    expect(status.accepted.every((r) => !r.outdated)).toBe(true);
  });

  it('treats an outdated acceptance as missing and flags the record', () => {
    const status = buildConsentStatus([
      record('credit_bureau'),
      record('terms', '2025-01-v1'),
      record('kyc_biometric'),
      record('aml'),
    ]);
    expect(status.missing).toEqual(['terms']);
    expect(status.complete).toBe(false);
    const terms = status.accepted.find((r) => r.code === 'terms');
    expect(terms?.outdated).toBe(true);
  });

  it('a later re-acceptance at the current version clears an outdated one and keeps the history', () => {
    const status = buildConsentStatus([
      record('terms', '2025-01-v1', { acceptedAt: new Date('2026-01-01T00:00:00Z') }),
      record('terms', CURRENT, { acceptedAt: new Date('2026-09-01T00:00:00Z') }),
      record('credit_bureau'),
      record('kyc_biometric'),
      record('aml'),
    ]);
    expect(status.missing).toEqual([]);
    expect(status.complete).toBe(true);
    expect(status.accepted.filter((r) => r.code === 'terms')).toHaveLength(2);
  });

  it('orders newest first and maps actor, application and locale onto the wire DTO', () => {
    const older = record('aml', CURRENT, { acceptedAt: new Date('2026-08-01T00:00:00Z') });
    const newer = record('terms', CURRENT, {
      acceptedAt: new Date('2026-09-05T00:00:00Z'),
      applicationId: 'app-1',
      channel: 'assisted',
      locale: 'ar',
      actor: { name: 'Sales Exec' },
    });
    const status = buildConsentStatus([older, newer]);
    expect(status.accepted.map((r) => r.code)).toEqual(['terms', 'aml']);
    expect(status.accepted[0]).toMatchObject({
      application_id: 'app-1',
      channel: 'assisted',
      locale: 'ar',
      actor_name: 'Sales Exec',
      accepted_at: '2026-09-05T00:00:00.000Z',
      outdated: false,
    });
    expect(status.accepted[1].actor_name).toBeNull();
  });
});

describe('consentOutdated', () => {
  it('is false for the current version and true for anything else', () => {
    expect(consentOutdated({ code: 'terms', version: CURRENT })).toBe(false);
    expect(consentOutdated({ code: 'terms', version: 'old' })).toBe(true);
    expect(consentOutdated({ code: 'unknown', version: CURRENT })).toBe(true);
  });
});

describe('consentTextHash', () => {
  it('hashes exactly the catalog text for the locale shown', () => {
    const expected = createHash('sha256')
      .update(consentFullText(CONSENT_CATALOG.terms, 'ar'), 'utf8')
      .digest('hex');
    expect(consentTextHash('terms', 'ar')).toBe(expected);
    expect(consentTextHash('terms', 'en')).not.toBe(consentTextHash('terms', 'ar'));
    expect(consentTextHash('terms', 'en')).toBe(consentTextHash('terms', 'en'));
  });
});

describe('request helpers', () => {
  it('derives the channel from the x-blox-channel header', () => {
    expect(consentChannelFromHeader(undefined)).toBe('web');
    expect(consentChannelFromHeader('web')).toBe('web');
    expect(consentChannelFromHeader('mobile')).toBe('mobile');
    expect(consentChannelFromHeader(' MOBILE ')).toBe('mobile');
    expect(consentChannelFromHeader(['mobile', 'web'])).toBe('mobile');
  });

  it('normalises the locale to en or ar', () => {
    expect(normalizeConsentLocale('ar')).toBe('ar');
    expect(normalizeConsentLocale('en')).toBe('en');
    expect(normalizeConsentLocale('fr')).toBe('en');
    expect(normalizeConsentLocale(undefined)).toBe('en');
  });
});
