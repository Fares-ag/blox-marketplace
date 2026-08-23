import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  hashRefreshToken,
  newRefreshToken,
  signMobileAccessToken,
  verifyMobileAccessToken,
} from './mobile-token';

describe('mobile-token', () => {
  const secret = 'a-sufficiently-long-test-secret-value-32';

  it('signs and verifies an access token', () => {
    const { token } = signMobileAccessToken(secret, {
      sub: 'user_1',
      email: 'a@b.co',
      role: 'customer',
    });
    const payload = verifyMobileAccessToken(secret, token);
    expect(payload?.sub).toBe('user_1');
    expect(payload?.email).toBe('a@b.co');
  });

  it('rejects a tampered token', () => {
    const { token } = signMobileAccessToken(secret, {
      sub: 'user_1',
      email: 'a@b.co',
      role: 'customer',
    });
    const tampered = token.slice(0, -2) + 'ab';
    expect(verifyMobileAccessToken(secret, tampered)).toBeNull();
  });

  it('hashes refresh tokens stably', () => {
    const { raw, hash } = newRefreshToken();
    expect(hashRefreshToken(raw)).toBe(hash);
    expect(createHmac('sha256', 'refresh').update(raw).digest('hex')).toBe(hash);
  });
});
