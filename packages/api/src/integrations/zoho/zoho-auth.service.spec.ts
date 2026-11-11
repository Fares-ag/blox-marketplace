import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithTimeout = vi.fn();

vi.mock('../../common/fetch-with-timeout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../common/fetch-with-timeout')>();
  return { ...actual, fetchWithTimeout: (...args: unknown[]) => fetchWithTimeout(...args) };
});

import { ZohoAuthService } from './zoho-auth.service';

describe('ZohoAuthService', () => {
  beforeEach(() => {
    fetchWithTimeout.mockReset();
  });

  it('caches the token api_domain from refresh', async () => {
    fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'tok',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.com/',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const auth = new ZohoAuthService({
      accountsUrl: 'https://accounts.zoho.com',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: `1000.${'a'.repeat(40)}`,
      apiDomain: 'https://sandbox.zohoapis.com',
      httpTimeoutMs: 8000,
    } as never);

    await auth.getAccessToken();
    expect(auth.resolvedApiDomain()).toBe('https://www.zohoapis.com');
  });
});
