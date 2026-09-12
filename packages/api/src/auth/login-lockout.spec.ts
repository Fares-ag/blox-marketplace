import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_LOCKOUT,
  isAccountLocked,
  lockoutExpiresAt,
  lockoutMessage,
} from './login-lockout';

describe('login lockout helpers', () => {
  const now = new Date('2026-08-20T10:00:00.000Z');

  it('detects active lockouts', () => {
    expect(isAccountLocked({ lockedUntil: null }, now)).toBe(false);
    expect(isAccountLocked({ lockedUntil: new Date('2026-08-20T09:00:00.000Z') }, now)).toBe(false);
    expect(isAccountLocked({ lockedUntil: new Date('2026-08-20T10:05:00.000Z') }, now)).toBe(true);
  });

  it('locks after the configured number of failures', () => {
    expect(lockoutExpiresAt(4, DEFAULT_LOGIN_LOCKOUT, now)).toBeNull();
    const lockedUntil = lockoutExpiresAt(5, DEFAULT_LOGIN_LOCKOUT, now);
    expect(lockedUntil?.toISOString()).toBe('2026-08-20T10:15:00.000Z');
  });

  it('formats a human-readable lockout message', () => {
    expect(lockoutMessage(new Date('2026-08-20T10:05:00.000Z'), now)).toMatch(/Wait 5 minutes/);
    expect(lockoutMessage(null, now)).toMatch(/Try again later/);
  });
});
