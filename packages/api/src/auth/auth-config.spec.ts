import { afterEach, describe, expect, it } from 'vitest';
import {
  INSECURE_AUTH_SECRET,
  resolveApiPort,
  resolveAuthSecret,
  resolveCookieDomain,
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
