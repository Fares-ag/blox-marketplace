import { describe, expect, it } from 'vitest';
import {
  decodePasswordResetOtpRecord,
  encodePasswordResetOtpRecord,
  hashPasswordResetOtp,
  isMobilePasswordReset,
  passwordResetOtpMatches,
  readPasswordResetOtp,
} from './password-reset-otp';

describe('password reset OTP payload', () => {
  it('treats only boolean true as the mobile request', () => {
    expect(isMobilePasswordReset({ isMobile: true })).toBe(true);
    expect(isMobilePasswordReset({ isMobile: false })).toBe(false);
    expect(isMobilePasswordReset({})).toBe(false);
    expect(isMobilePasswordReset(undefined)).toBe(false);
  });

  it('reads OTP and the lowercase alias', () => {
    expect(readPasswordResetOtp({ OTP: ' 123456 ' })).toBe('123456');
    expect(readPasswordResetOtp({ otp: '654321' })).toBe('654321');
    expect(readPasswordResetOtp({ token: 'abc' })).toBe('');
  });

  it('matches a code only against the email it was issued for', () => {
    const hash = hashPasswordResetOtp('secret', 'sara@example.com', '123456');
    expect(passwordResetOtpMatches('secret', 'sara@example.com', '123456', hash)).toBe(true);
    expect(passwordResetOtpMatches('secret', 'other@example.com', '123456', hash)).toBe(false);
    expect(passwordResetOtpMatches('secret', 'sara@example.com', '000000', hash)).toBe(false);
  });

  it('round-trips the stored attempt counter', () => {
    const encoded = encodePasswordResetOtpRecord({ hash: 'abc', attempts: 2 });
    expect(decodePasswordResetOtpRecord(encoded)).toEqual({ hash: 'abc', attempts: 2 });
    expect(decodePasswordResetOtpRecord('nope')).toBeNull();
  });
});
