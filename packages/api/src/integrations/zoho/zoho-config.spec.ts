import { describe, expect, it } from 'vitest';
import { ZohoConfig } from './zoho-config';

const VALID_REFRESH_TOKEN = `1000.${'a'.repeat(40)}`;

function makeConfig(values: Record<string, string | undefined>) {
  return new ZohoConfig({ get: (key: string) => values[key] } as never);
}

const CREDENTIALS = {
  ZOHO_CLIENT_ID: '1000.CLIENTID',
  ZOHO_CLIENT_SECRET: 'client-secret-value',
  ZOHO_REFRESH_TOKEN: VALID_REFRESH_TOKEN,
};

describe('ZohoConfig', () => {
  it('is simply disabled (not an error) when no credentials are set', () => {
    const cfg = makeConfig({});
    expect(cfg.hasCredentials).toBe(false);
    expect(cfg.enabled).toBe(false);
    expect(cfg.configurationError).toBeNull();
  });

  it('treats a placeholder refresh token as absent', () => {
    const cfg = makeConfig({ ...CREDENTIALS, ZOHO_REFRESH_TOKEN: '<your-refresh-token>' });
    expect(cfg.hasCredentials).toBe(false);
    expect(cfg.enabled).toBe(false);
  });

  // Z5 regression: the old code silently defaulted to sandbox.zohoapis.com,
  // so a production deploy that forgot ZOHO_API_DOMAIN sent the finance
  // partner's leads to a sandbox instead of failing loudly.
  it('never defaults the API domain', () => {
    const cfg = makeConfig(CREDENTIALS);
    expect(cfg.apiDomain).toBe('');
    expect(cfg.configurationError).toBe('zoho_api_domain_missing');
    expect(cfg.enabled).toBe(false);
  });

  it('rejects a non-https API domain', () => {
    const cfg = makeConfig({ ...CREDENTIALS, ZOHO_API_DOMAIN: 'http://www.zohoapis.com' });
    expect(cfg.configurationError).toBe('zoho_api_domain_invalid');
    expect(cfg.enabled).toBe(false);
  });

  it('rejects a host that is not a Zoho API domain', () => {
    const cfg = makeConfig({ ...CREDENTIALS, ZOHO_API_DOMAIN: 'https://evil.example.com' });
    expect(cfg.configurationError).toBe('zoho_api_domain_invalid');
    expect(cfg.enabled).toBe(false);
  });

  it('rejects an unparseable API domain', () => {
    const cfg = makeConfig({ ...CREDENTIALS, ZOHO_API_DOMAIN: 'www.zohoapis.com' });
    expect(cfg.configurationError).toBe('zoho_api_domain_invalid');
  });

  it('enables with an explicit production domain and trims a trailing slash', () => {
    const cfg = makeConfig({ ...CREDENTIALS, ZOHO_API_DOMAIN: 'https://www.zohoapis.com/' });
    expect(cfg.configurationError).toBeNull();
    expect(cfg.enabled).toBe(true);
    expect(cfg.apiDomain).toBe('https://www.zohoapis.com');
  });

  it('supports sandbox and non-global data centres', () => {
    for (const domain of [
      'https://sandbox.zohoapis.com',
      'https://www.zohoapis.eu',
      'https://www.zohoapis.sa',
    ]) {
      const cfg = makeConfig({ ...CREDENTIALS, ZOHO_API_DOMAIN: domain });
      expect(cfg.enabled).toBe(true);
      expect(cfg.apiDomain).toBe(domain);
    }
  });

  it('boot logging never throws, in any configuration state', () => {
    expect(() => makeConfig({}).onModuleInit()).not.toThrow();
    expect(() => makeConfig(CREDENTIALS).onModuleInit()).not.toThrow();
    expect(() =>
      makeConfig({
        ...CREDENTIALS,
        ZOHO_API_DOMAIN: 'https://www.zohoapis.eu',
        ZOHO_ACCOUNTS_URL: 'not-a-url',
      }).onModuleInit(),
    ).not.toThrow();
  });
});
