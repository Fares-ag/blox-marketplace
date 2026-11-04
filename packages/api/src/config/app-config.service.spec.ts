import { describe, expect, it } from 'vitest';
import { AppConfigService } from './app-config.service';

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  };
}

describe('AppConfigService', () => {
  it('resolves marketplace URL from MARKETPLACE_URL', () => {
    const service = new AppConfigService(
      mockConfig({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
        MARKETPLACE_URL: 'https://blox.market/',
      }) as never,
    );
    expect(service.marketplaceUrl).toBe('https://blox.market');
    expect(service.marketplacePath('/quotes/abc')).toBe('https://blox.market/quotes/abc');
  });

  it('keeps musharakah flow flags off unless explicitly enabled', () => {
    const service = new AppConfigService(
      mockConfig({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
        MARKETPLACE_URL: 'https://blox.market',
      }) as never,
    );
    expect(service.musharakahRegisterEnabled).toBe(false);
    expect(service.unitOffersEnabled).toBe(false);
    expect(service.lpoGateEnabled).toBe(false);
    expect(service.preDisbursalGateEnabled).toBe(false);
    expect(service.kycWebhookDrivesStatus).toBe(false);
    expect(service.bureauReportingEnabled).toBe(false);
    expect(service.bureauIncludeAllCompanies).toBe(false);
    expect(service.bureauSftpEnabled).toBe(false);
    expect(service.bureauTransport).toBe('local');
    expect(service.bureauCompanyIds).toEqual([]);
  });

  it('refuses auto-send in production', () => {
    expect(
      () =>
        new AppConfigService(
          mockConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://localhost:5432/test',
            BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
            MARKETPLACE_URL: 'https://blox.market',
            BUREAU_AUTO_SEND: 'true',
          }) as never,
        ),
    ).toThrow('BUREAU_AUTO_SEND is not permitted in production');
  });

  it('refuses include-all companies in production', () => {
    expect(
      () =>
        new AppConfigService(
          mockConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://localhost:5432/test',
            BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
            MARKETPLACE_URL: 'https://blox.market',
            BUREAU_INCLUDE_ALL_COMPANIES: 'true',
          }) as never,
        ),
    ).toThrow('BUREAU_INCLUDE_ALL_COMPANIES is not permitted in production');
  });

  const productionCors =
    'https://blox.market,https://www.blox.market,https://dealer.blox.market,https://credit.blox.market,https://finance.blox.market,https://admin.blox.market,https://ops.blox.market';

  it('resolves staff portal URLs from production CORS hostnames when explicit URLs are unset', () => {
    const service = new AppConfigService(
      mockConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
        MARKETPLACE_URL: 'https://www.blox.market',
        CORS_ORIGINS: productionCors,
      }) as never,
    );
    expect(service.dealerUrl).toBe('https://dealer.blox.market');
    expect(service.creditUrl).toBe('https://credit.blox.market');
    expect(service.financeUrl).toBe('https://finance.blox.market');
    expect(service.adminUrl).toBe('https://admin.blox.market');
    expect(service.superAdminUrl).toBe('https://ops.blox.market');
    expect(service.portalSignInUrl('dealer_agent' as never)).toBe('https://dealer.blox.market/auth/sign-in');
  });

  it('refuses localhost staff portal URLs in production', () => {
    expect(
      () =>
        new AppConfigService(
          mockConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://localhost:5432/test',
            BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
            MARKETPLACE_URL: 'https://www.blox.market',
            CORS_ORIGINS: 'https://www.blox.market',
          }) as never,
        ),
    ).toThrow('ADMIN_URL resolved to a local URL in production');
  });

  it('throws when MARKETPLACE_URL is missing in production', () => {
    expect(
      () =>
        new AppConfigService(
          mockConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://localhost:5432/test',
            BETTER_AUTH_SECRET: 'integration-test-secret-with-sufficient-entropy-abcdef123456',
          }) as never,
        ),
    ).toThrow('MARKETPLACE_URL is required in production');
  });
});
