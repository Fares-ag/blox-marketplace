import { afterEach, describe, expect, it } from 'vitest';
import {
  INSECURE_AUTH_SECRET,
  isMfaEnforcementActive,
  resolveApiPort,
  resolveAuthSecret,
  resolveCookieDomain,
  resolveMfaEnforcement,
  resolvePrivilegedLoginLockout,
  resolveSessionCookieCacheMaxAge,
} from './auth-config';

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  };
}

describe('resolveAuthSecret', () => {
  it('throws when secret is missing', () => {
    expect(() => resolveAuthSecret(mockConfig({}) as never)).toThrow(/BETTER_AUTH_SECRET is required/);
  });

  it('throws when secret equals insecure dev default', () => {
    expect(() =>
      resolveAuthSecret(mockConfig({ BETTER_AUTH_SECRET: INSECURE_AUTH_SECRET }) as never),
    ).toThrow(/known placeholder/);
  });

  it('throws when secret is too short', () => {
    expect(() =>
      resolveAuthSecret(mockConfig({ BETTER_AUTH_SECRET: 'shortvalue18Kq0Zw' }) as never),
    ).toThrow(/at least 32 characters/);
  });

  it('rejects the placeholder secret shipped in .env.example (regression: P0-1)', () => {
    expect(() =>
      resolveAuthSecret(
        mockConfig({
          BETTER_AUTH_SECRET: 'dev-change-me-to-a-long-random-string-32chars',
        }) as never,
      ),
    ).toThrow(/placeholder/);
  });

  it('rejects placeholder-looking secrets even when long enough', () => {
    expect(() =>
      resolveAuthSecret(
        mockConfig({ BETTER_AUTH_SECRET: 'please-CHANGE_ME-a1b2c3d4e5f6g7h8i9j0k1l2' }) as never,
      ),
    ).toThrow(/placeholder/);
  });

  it('rejects low-entropy secrets', () => {
    expect(() =>
      resolveAuthSecret(
        mockConfig({ BETTER_AUTH_SECRET: 'aaaaabbbbbaaaaabbbbbaaaaabbbbbaa' }) as never,
      ),
    ).toThrow(/entropy/);
  });

  it('returns a valid secret', () => {
    const secret = 'JZ0mQ4vTn8xW2pLc6RyBd1KsF7hAe5Ug3NiV9oXr';
    expect(resolveAuthSecret(mockConfig({ BETTER_AUTH_SECRET: secret }) as never)).toBe(secret);
  });
});

describe('resolveCookieDomain', () => {
  it('returns undefined when COOKIE_DOMAIN is unset', () => {
    expect(resolveCookieDomain(mockConfig({}) as never)).toBeUndefined();
  });

  it('returns trimmed domain when set', () => {
    expect(
      resolveCookieDomain(mockConfig({ COOKIE_DOMAIN: ' .blox.market ' }) as never),
    ).toBe('.blox.market');
  });
});

describe('resolveSessionCookieCacheMaxAge', () => {
  it('defaults to 0 (disabled) so idle refresh is not skipped', () => {
    expect(resolveSessionCookieCacheMaxAge(mockConfig({}) as never)).toBe(0);
  });

  it('parses SESSION_COOKIE_CACHE_MAX_AGE_SEC', () => {
    expect(
      resolveSessionCookieCacheMaxAge(
        mockConfig({ SESSION_COOKIE_CACHE_MAX_AGE_SEC: '60' }) as never,
      ),
    ).toBe(60);
  });
});

describe('resolvePrivilegedLoginLockout', () => {
  it('uses secure defaults', () => {
    expect(resolvePrivilegedLoginLockout(mockConfig({}) as never)).toEqual({
      maxFailedAttempts: 5,
      lockoutDurationSeconds: 900,
    });
  });
});

describe('resolveApiPort', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
  });

  it('prefers PORT env over API_PORT config', () => {
    process.env.PORT = '8080';
    expect(resolveApiPort(mockConfig({ API_PORT: '3010' }) as never)).toBe(8080);
  });

  it('falls back to API_PORT then 3010', () => {
    delete process.env.PORT;
    expect(resolveApiPort(mockConfig({ API_PORT: '4000' }) as never)).toBe(4000);
    expect(resolveApiPort(mockConfig({}) as never)).toBe(3010);
  });
});

describe('resolveMfaEnforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('defaults to disabled unless MFA_ENFORCE=true', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveMfaEnforcement(mockConfig({}) as never).enforced).toBe(false);
  });

  it('can be enabled explicitly in production', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveMfaEnforcement(mockConfig({ MFA_ENFORCE: 'true' }) as never).enforced).toBe(true);
  });

  it('honours MFA_ENFORCE override and MFA_GRACE_UNTIL', () => {
    process.env.NODE_ENV = 'production';
    const cfg = resolveMfaEnforcement(
      mockConfig({ MFA_ENFORCE: 'false', MFA_GRACE_UNTIL: '2030-01-01T00:00:00.000Z' }) as never,
    );
    expect(cfg.enforced).toBe(false);
    expect(cfg.graceUntil?.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  it('throws on invalid MFA_GRACE_UNTIL', () => {
    expect(() =>
      resolveMfaEnforcement(mockConfig({ MFA_GRACE_UNTIL: 'not-a-date' }) as never),
    ).toThrow(/MFA_GRACE_UNTIL/);
  });
});

describe('isMfaEnforcementActive', () => {
  it('is inactive during grace period', () => {
    expect(
      isMfaEnforcementActive(
        { enforced: true, graceUntil: new Date('2030-01-01T00:00:00.000Z') },
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('is active after grace period expires', () => {
    expect(
      isMfaEnforcementActive(
        { enforced: true, graceUntil: new Date('2020-01-01T00:00:00.000Z') },
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });
});
