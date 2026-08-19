import type { ConfigService } from '@nestjs/config';

/** Hard-coded fallback in auth.ts — must never be used in production. */
export const INSECURE_AUTH_SECRET = 'dev-secret-change-me';

/**
 * Known placeholder secrets that have shipped in this repo's templates.
 * Any of these in any environment is a critical misconfiguration.
 */
export const KNOWN_PLACEHOLDER_SECRETS = [
  INSECURE_AUTH_SECRET,
  'dev-change-me-to-a-long-random-string-32chars',
];

/** Placeholder-looking patterns ("change-me", "changeme", "dev-", "example", "placeholder"). */
const PLACEHOLDER_PATTERN = /change[-_]?me|placeholder|example|secret[-_]?here|^dev[-_]/i;

export function resolveAuthSecret(config: ConfigService): string {
  const secret = config.get<string>('BETTER_AUTH_SECRET')?.trim();

  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET is required. Generate one with: openssl rand -base64 48',
    );
  }

  if (KNOWN_PLACEHOLDER_SECRETS.includes(secret)) {
    throw new Error(
      'BETTER_AUTH_SECRET matches a known placeholder shipped in .env.example. ' +
        'Generate a unique secret (openssl rand -base64 48) and set it via your secret manager.',
    );
  }

  if (PLACEHOLDER_PATTERN.test(secret)) {
    throw new Error(
      'BETTER_AUTH_SECRET looks like a placeholder (contains "change-me"/"dev-"/"example"). ' +
        'Generate a unique secret (openssl rand -base64 48).',
    );
  }

  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  // Low-entropy guard: a real secret has a reasonable spread of distinct characters.
  const distinct = new Set(secret).size;
  if (distinct < 10) {
    throw new Error('BETTER_AUTH_SECRET has too little entropy (repeated characters).');
  }

  return secret;
}

export function resolveAuthBaseUrl(config: ConfigService): string {
  return config.get<string>('BETTER_AUTH_URL') ?? 'http://localhost:3010';
}

export function resolveApiPort(config: ConfigService): number {
  // Railway injects PORT; prefer it over API_PORT for platform deploys.
  const port = process.env.PORT ?? config.get<string>('API_PORT') ?? 3010;
  return Number(port);
}

/**
 * Whether sign-in and applying require a verified email (P0-3).
 * Explicit REQUIRE_EMAIL_VERIFICATION wins; otherwise defaults to true in
 * production and false in development.
 */
export function resolveRequireEmailVerification(config: ConfigService): boolean {
  const raw = config.get<string>('REQUIRE_EMAIL_VERIFICATION')?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV === 'production';
}

/** When set (e.g. `.blox.market`), enables cross-subdomain session cookies in production. */
export function resolveCookieDomain(config: ConfigService): string | undefined {
  const domain = config.get<string>('COOKIE_DOMAIN')?.trim();
  return domain || undefined;
}
