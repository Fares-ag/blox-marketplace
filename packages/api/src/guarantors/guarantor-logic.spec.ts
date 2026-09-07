import { describe, expect, it } from 'vitest';
import { CONSENT_CATALOG, CONSENT_CATALOG_VERSION } from '@drivemarket/shared/domain-rules';
import { evaluateOtpAttempt, issuedOtpPatch } from '../assist/assist-logic';
import { generateOtp, hashOtp, OTP_POLICY, otpMatches, type OtpState } from '../common/otp';
import { consentTextHash } from '../consents/consent-logic';
import {
  acceptedGuarantorCodes,
  advanceGuarantorStatus,
  buildGuarantorAcceptances,
  effectiveGuarantorStatus,
  firstNameOf,
  GUARANTOR_CONSENT_CODES,
  guarantorFromSnapshot,
  guarantorSmsBody,
  isGuarantorSessionOpen,
  toGuarantorSessionDto,
  toGuarantorSessionPublicDto,
  validateGuarantorAcceptances,
} from './guarantor-logic';

const NOW = new Date('2026-09-07T10:00:00Z');
const SECRET = 'test-secret';
const SESSION_ID = 'gs_1';

function issued(overrides: Partial<OtpState> = {}): OtpState {
  return {
    otpExpiresAt: new Date(NOW.getTime() + OTP_POLICY.ttlMs),
    otpAttempts: 0,
    otpLockedUntil: null,
    otpResendCount: 0,
    otpResendWindowStart: null,
    ...overrides,
  };
}

const SNAPSHOT = {
  full_name: 'Aisha Al Thani',
  phone: '55512345',
  hasGuarantor: true,
  guarantor: {
    fullName: 'Mohammed Al Thani',
    qid: '28834512345',
    phone: '+974 5555 6789',
    relationship: 'sibling',
    monthlyIncome: 18000,
  },
};

describe('guarantorFromSnapshot', () => {
  it('reads the guarantor block of the customer snapshot', () => {
    expect(guarantorFromSnapshot(SNAPSHOT)).toEqual({
      fullName: 'Mohammed Al Thani',
      phone: '+974 5555 6789',
      qid: '28834512345',
      email: null,
      relationship: 'sibling',
      monthlyIncome: 18000,
    });
  });

  it('is null without a declared guarantor or when name/phone are missing', () => {
    expect(guarantorFromSnapshot(null)).toBeNull();
    expect(guarantorFromSnapshot({ full_name: 'A' })).toBeNull();
    expect(guarantorFromSnapshot({ ...SNAPSHOT, hasGuarantor: false })).toBeNull();
    expect(guarantorFromSnapshot({ guarantor: { fullName: 'Only Name' } })).toBeNull();
    expect(guarantorFromSnapshot({ guarantor: { phone: '55551234' } })).toBeNull();
  });

  it('tolerates snake_case keys and lowercases the email', () => {
    expect(
      guarantorFromSnapshot({ guarantor: { full_name: 'X Y', phone: '5555', email: ' G@Example.com ' } }),
    ).toMatchObject({ fullName: 'X Y', email: 'g@example.com', monthlyIncome: null });
  });
});

describe('status machine', () => {
  it('reads an open session past its expiry as expired, never a terminal one', () => {
    const past = new Date(NOW.getTime() - 1000);
    const future = new Date(NOW.getTime() + 60_000);
    expect(effectiveGuarantorStatus({ status: 'pending', expiresAt: future }, NOW)).toBe('pending');
    expect(effectiveGuarantorStatus({ status: 'consents_done', expiresAt: past }, NOW)).toBe('expired');
    expect(effectiveGuarantorStatus({ status: 'completed', expiresAt: past }, NOW)).toBe('completed');
    expect(effectiveGuarantorStatus({ status: 'cancelled', expiresAt: past }, NOW)).toBe('cancelled');
  });

  it('only moves forward and never reopens a closed session', () => {
    expect(advanceGuarantorStatus('pending', 'otp_verified')).toBe('otp_verified');
    expect(advanceGuarantorStatus('consents_done', 'otp_verified')).toBe('consents_done');
    expect(advanceGuarantorStatus('cancelled', 'otp_verified')).toBe('cancelled');
    expect(isGuarantorSessionOpen('consents_done')).toBe(true);
    expect(isGuarantorSessionOpen('completed')).toBe(false);
  });
});

describe('OTP wiring', () => {
  it('verifies the code hashed for this session and rejects another session\'s hash', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    const patch = issuedOtpPatch(hashOtp(SECRET, SESSION_ID, code), NOW);
    expect(patch.otpExpiresAt.getTime()).toBe(NOW.getTime() + OTP_POLICY.ttlMs);
    expect(otpMatches(SECRET, SESSION_ID, code, patch.otpCodeHash)).toBe(true);
    expect(otpMatches(SECRET, 'gs_other', code, patch.otpCodeHash)).toBe(false);
    expect(otpMatches(SECRET, SESSION_ID, '000000', patch.otpCodeHash)).toBe(code === '000000');
  });

  it('counts down the remaining attempts and locks on the last one', () => {
    let state = issued();
    for (let attempt = 1; attempt < OTP_POLICY.maxAttempts; attempt += 1) {
      const result = evaluateOtpAttempt(state, false, NOW);
      expect(result.outcome).toBe('invalid');
      if (result.outcome !== 'invalid') return;
      expect(result.remaining).toBe(OTP_POLICY.maxAttempts - attempt);
      expect(result.lockedForSec).toBeNull();
      state = { ...state, ...result.patch };
    }
    const last = evaluateOtpAttempt(state, false, NOW);
    expect(last.outcome).toBe('invalid');
    if (last.outcome !== 'invalid') return;
    expect(last.remaining).toBe(0);
    expect(last.lockedForSec).toBe(OTP_POLICY.lockMs / 1000);
    const locked = evaluateOtpAttempt({ ...state, ...last.patch }, true, NOW);
    expect(locked).toEqual({ outcome: 'locked', retryAfterSec: OTP_POLICY.lockMs / 1000 });
  });

  it('reports an expired or never-issued code and verifies a matching one', () => {
    expect(evaluateOtpAttempt(issued({ otpExpiresAt: new Date(NOW.getTime() - 1) }), true, NOW)).toEqual({
      outcome: 'expired',
    });
    expect(evaluateOtpAttempt(issued({ otpExpiresAt: null }), true, NOW)).toEqual({ outcome: 'not_issued' });
    expect(evaluateOtpAttempt(issued(), true, NOW)).toEqual({ outcome: 'verified' });
  });
});

describe('guarantor acceptances', () => {
  const CURRENT = CONSENT_CATALOG_VERSION;
  const ALL = GUARANTOR_CONSENT_CODES.map((code) => ({ code, version: CURRENT }));

  it('accepts exactly the three guarantor consents at the current version', () => {
    const result = validateGuarantorAcceptances([...ALL, { code: 'terms', version: CURRENT }]);
    expect(result).toEqual({ ok: true, accepted: ALL });
  });

  it('rejects unknown codes, non-guarantor codes and outdated versions', () => {
    expect(validateGuarantorAcceptances([{ code: 'marketing', version: CURRENT }])).toEqual({
      ok: false,
      error: 'consent_code_invalid',
      code: 'marketing',
    });
    expect(validateGuarantorAcceptances([{ code: 'kyc_biometric', version: CURRENT }])).toEqual({
      ok: false,
      error: 'consent_code_invalid',
      code: 'kyc_biometric',
    });
    expect(validateGuarantorAcceptances([{ code: 'aml', version: '2025-01-v1' }])).toEqual({
      ok: false,
      error: 'consent_version_outdated',
      code: 'aml',
    });
  });

  it('requires all three together', () => {
    expect(validateGuarantorAcceptances([{ code: 'terms', version: CURRENT }])).toEqual({
      ok: false,
      error: 'guarantor_consents_incomplete',
      missing: ['credit_bureau', 'aml'],
    });
  });

  it('stores the hash of the exact catalog text in the locale shown', () => {
    const rows = buildGuarantorAcceptances(ALL, 'ar', NOW);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      code: 'credit_bureau',
      version: CONSENT_CATALOG.credit_bureau.version,
      textHash: consentTextHash('credit_bureau', 'ar'),
      locale: 'ar',
      acceptedAt: NOW.toISOString(),
    });
    expect(buildGuarantorAcceptances(ALL, 'fr', NOW)[0].locale).toBe('en');
    expect(acceptedGuarantorCodes(rows as unknown as never)).toEqual(['credit_bureau', 'terms', 'aml']);
    expect(acceptedGuarantorCodes([{ code: 'aml' }, { nope: true }, 'x'] as unknown as never)).toEqual(['aml']);
    expect(acceptedGuarantorCodes(null)).toEqual([]);
  });
});

describe('DTOs and messages', () => {
  const session = {
    id: 'gs_1',
    applicationId: 'app_1',
    status: 'pending' as const,
    fullName: 'Mohammed Al Thani',
    phone: '+97455556789',
    relationship: 'sibling',
    consentsCompletedAt: null,
    kycStatus: null,
    expiresAt: new Date(NOW.getTime() + 60_000),
    lastOpenedAt: null,
    createdAt: NOW,
    kycInviteUrl: null,
  };

  it('masks the phone and only echoes the link when given', () => {
    const dto = toGuarantorSessionDto(session, undefined, NOW);
    expect(dto.phone_masked).toBe('+974 XXXX X789');
    expect(dto.phone_masked).not.toContain('5555');
    expect(dto).not.toHaveProperty('link');
    expect(dto.status).toBe('pending');
    expect(toGuarantorSessionDto(session, 'https://m/guarantor/tok', NOW).link).toBe('https://m/guarantor/tok');
    expect(toGuarantorSessionDto({ ...session, expiresAt: new Date(NOW.getTime() - 1) }, undefined, NOW).status).toBe(
      'expired',
    );
  });

  it('public view shows first names only, the three consent codes and the applicant locale', () => {
    const dto = toGuarantorSessionPublicDto({
      session,
      status: 'otp_verified',
      applicantName: 'Aisha Al Thani',
      dealerName: 'Chery Elite Motors',
      vehicle: { make: 'Chery', model: 'Tiggo 8', modelYear: 2026 },
      locale: 'ar',
    });
    expect(dto).toEqual({
      status: 'otp_verified',
      guarantor_first_name: 'Mohammed',
      applicant_first_name: 'Aisha',
      dealer_name: 'Chery Elite Motors',
      vehicle: { make: 'Chery', model: 'Tiggo 8', model_year: 2026 },
      consent_codes: ['credit_bureau', 'terms', 'aml'],
      consent_locale: 'ar',
      expires_at: session.expiresAt.toISOString(),
      kyc_url: null,
    });
    expect(JSON.stringify(dto)).not.toContain('5555');
    expect(firstNameOf('  ')).toBeNull();
  });

  it('SMS carries the link and the code, never more of the applicant than a first name', () => {
    const link = guarantorSmsBody('link', { applicantName: 'Aisha Al Thani', link: 'https://m/g/t', code: '123456' });
    expect(link).toContain('Aisha named you as guarantor');
    expect(link).not.toContain('Al Thani');
    expect(link).toContain('https://m/g/t');
    expect(link).toContain('123456');
    const otp = guarantorSmsBody('otp', { applicantName: null, link: 'https://m/g/t', code: '654321' });
    expect(otp).toContain('654321');
    expect(otp).toContain('https://m/g/t');
  });
});
