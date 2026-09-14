import type { ConfigService } from '@nestjs/config';
import type { LoginLockoutConfig } from './login-lockout';
import { DEFAULT_LOGIN_LOCKOUT } from './login-lockout';

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

/**
 * TEMPORARY (email-plan bridge): when true, new customer sign-ups skip the
 * verification email entirely and are auto-confirmed + auto-signed-in so they
 * can use the platform immediately. Enable this only while transactional email
 * is unavailable (e.g. the Postmark free tier is exhausted).
 *
 * To restore normal email verification: set AUTH_AUTO_CONFIRM_USERS=false (or
 * remove it) and redeploy — no code change required.
 */
export function resolveAutoConfirmUsers(config: ConfigService): boolean {
  const raw = config.get<string>('AUTH_AUTO_CONFIRM_USERS')?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/** When set (e.g. `.blox.market`), enables cross-subdomain session cookies in production. */
export function resolveCookieDomain(config: ConfigService): string | undefined {
  const domain = config.get<string>('COOKIE_DOMAIN')?.trim();
  return domain || undefined;
}

/**
 * Better Auth session cookie cache TTL (seconds).
 *
 * This cache only affects how often Better Auth re-reads the session row from
 * Postgres — it does NOT affect authorization in this API, because
 * `SessionAuthGuard` always reloads the `User` row from the database.
 *
 * Default: 0 (disabled). A cached cookie used to skip Better Auth's idle
 * refresh, so an active user could still be signed out after `expiresIn`.
 * Set SESSION_COOKIE_CACHE_MAX_AGE_SEC to trade fewer DB reads for slower
 * revocation; keep it well below SESSION_IDLE_TIMEOUT_SEC.
 */
export function resolveSessionCookieCacheMaxAge(config: ConfigService): number {
  const raw = config.get<string>('SESSION_COOKIE_CACHE_MAX_AGE_SEC')?.trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('SESSION_COOKIE_CACHE_MAX_AGE_SEC must be a non-negative number.');
  }
  return Math.floor(parsed);
}

/** Password sign-in lockout for privileged ops roles (admin/credit/finance). */
export function resolvePrivilegedLoginLockout(config: ConfigService): LoginLockoutConfig {
  const maxRaw = config.get<string>('PRIVILEGED_LOGIN_MAX_ATTEMPTS')?.trim();
  const durationRaw = config.get<string>('PRIVILEGED_LOGIN_LOCKOUT_SEC')?.trim();

  const maxFailedAttempts = maxRaw ? Number(maxRaw) : DEFAULT_LOGIN_LOCKOUT.maxFailedAttempts;
  const lockoutDurationSeconds = durationRaw
    ? Number(durationRaw)
    : DEFAULT_LOGIN_LOCKOUT.lockoutDurationSeconds;

  if (!Number.isFinite(maxFailedAttempts) || maxFailedAttempts < 1) {
    throw new Error('PRIVILEGED_LOGIN_MAX_ATTEMPTS must be a positive number.');
  }
  if (!Number.isFinite(lockoutDurationSeconds) || lockoutDurationSeconds < 60) {
    throw new Error('PRIVILEGED_LOGIN_LOCKOUT_SEC must be at least 60.');
  }

  return {
    maxFailedAttempts: Math.floor(maxFailedAttempts),
    lockoutDurationSeconds: Math.floor(lockoutDurationSeconds),
  };
}

export type MfaEnforcementConfig = {
  enforced: boolean;
  graceUntil: Date | null;
};

/**
 * Whether privileged ops roles must have TOTP enabled before using protected API routes.
 * Opt-in via MFA_ENFORCE=true; optional MFA_GRACE_UNTIL ISO date delays enforcement.
 */
export function resolveMfaEnforcement(config: ConfigService): MfaEnforcementConfig {
  const raw = config.get<string>('MFA_ENFORCE')?.trim().toLowerCase();
  let enforced: boolean;
  if (raw === 'true' || raw === '1') enforced = true;
  else if (raw === 'false' || raw === '0') enforced = false;
  else enforced = false;

  const graceRaw = config.get<string>('MFA_GRACE_UNTIL')?.trim();
  if (!graceRaw) return { enforced, graceUntil: null };

  const graceUntil = new Date(graceRaw);
  if (Number.isNaN(graceUntil.getTime())) {
    throw new Error('MFA_GRACE_UNTIL must be a valid ISO date.');
  }
  return { enforced, graceUntil };
}

export function isMfaEnforcementActive(
  config: MfaEnforcementConfig,
  now: Date = new Date(),
): boolean {
  if (!config.enforced) return false;
  if (config.graceUntil && now < config.graceUntil) return false;
  return true;
}
