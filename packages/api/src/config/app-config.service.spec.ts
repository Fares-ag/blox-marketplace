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
