export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_PASSWORD = 'TestPassword123!';

export function applyIntegrationEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.NODE_ENV = 'test';
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET ??
    'integration-test-secret-with-sufficient-entropy-abcdef123456';
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3010';
  process.env.CORS_ORIGINS = TEST_ORIGIN;
  process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
  process.env.SKIPCASH_SANDBOX = 'false';

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
