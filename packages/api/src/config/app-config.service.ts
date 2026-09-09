import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';
import { resolveApiPort, resolveAuthSecret } from '../auth/auth-config';

function requireNonEmpty(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(trimmed)) return true;
  if (['0', 'false', 'no', 'off'].includes(trimmed)) return false;
  return fallback;
}

function parseOrigins(raw: string | undefined, fallback: string): string[] {
  return (raw ?? fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolvePortalBase(
  config: ConfigService,
  envKey: string,
  corsOrigins: string[],
  devPort: number,
): string {
  const explicit = config.get<string>(envKey)?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const fromCors = corsOrigins.find((origin) => new RegExp(`:${devPort}(?:/|$)`).test(origin));
  if (fromCors) return fromCors.replace(/\/$/, '');
  return `http://localhost:${devPort}`;
}

/** Validated, typed view of process env — constructed once at boot. */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  readonly nodeEnv: string;
  readonly apiPort: number;
  readonly corsOrigins: string[];
  readonly marketplaceUrl: string;
  readonly adminUrl: string;
  readonly superAdminUrl: string;
  readonly dealerUrl: string;
  readonly creditUrl: string;
  readonly financeUrl: string;
  readonly databaseUrl: string;
  /** Lifetime of an assisted-session link (minutes); the customer must verify the OTP within it. */
  readonly assistSessionTtlMinutes: number;
  /**
   * BRD Qatar e-KYC BR-7/BR-8: identity must be established by the KYC platform
   * (OCR + liveness + face match), never by a customer's hand-uploaded QID
   * photo. Defaults to on whenever the KYC integrator is configured;
   * KYC_EKYC_REQUIRED=false keeps the legacy manual slot for environments
   * without the platform.
   */
  readonly kycEkycRequired: boolean;
  /** Face-to-face branch procedure: staff may still attach the QID they inspected in person. */
  readonly kycAllowStaffManualIdentity: boolean;

  constructor(config: ConfigService) {
    this.nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
    this.apiPort = resolveApiPort(config);
    this.corsOrigins = parseOrigins(config.get<string>('CORS_ORIGINS'), 'http://localhost:5173');

    const marketplace =
      config.get<string>('MARKETPLACE_URL')?.trim() ??
      config.get<string>('VITE_MARKETPLACE_URL')?.trim();
    if (!marketplace && this.nodeEnv === 'production') {
      throw new Error('MARKETPLACE_URL is required in production');
    }
    this.marketplaceUrl = (marketplace ?? 'http://localhost:5173').replace(/\/$/, '');
    this.adminUrl = resolvePortalBase(config, 'ADMIN_URL', this.corsOrigins, 5174);
    this.superAdminUrl = resolvePortalBase(config, 'SUPER_ADMIN_URL', this.corsOrigins, 5175);
    this.dealerUrl = resolvePortalBase(config, 'DEALER_URL', this.corsOrigins, 5176);
    this.creditUrl = resolvePortalBase(config, 'CREDIT_URL', this.corsOrigins, 5177);
    this.financeUrl = resolvePortalBase(config, 'FINANCE_URL', this.corsOrigins, 5179);

    this.databaseUrl = requireNonEmpty(config.get<string>('DATABASE_URL'), 'DATABASE_URL');
    this.assistSessionTtlMinutes = parsePositiveInt(config.get<string>('ASSIST_SESSION_TTL_MINUTES'), 120);
    const kycConfigured = !!config.get<string>('KYC_API_KEY')?.trim();
    this.kycEkycRequired = parseBool(config.get<string>('KYC_EKYC_REQUIRED'), kycConfigured);
    this.kycAllowStaffManualIdentity = parseBool(config.get<string>('KYC_ALLOW_STAFF_MANUAL_IDENTITY'), true);
    if (kycConfigured && !this.kycEkycRequired) {
      this.logger.warn('KYC_EKYC_REQUIRED=false: customers may satisfy the identity slot with a manual QID upload');
    }

    // Fail fast on auth misconfiguration (throws with actionable message).
    resolveAuthSecret(config);

    if (this.nodeEnv === 'production' && !config.get<string>('REDIS_URL')?.trim()) {
      this.logger.warn(
        'REDIS_URL is not set — express-rate-limit uses an in-memory store (limits are per replica)',
      );
    }
  }

  marketplacePath(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.marketplaceUrl}${normalized}`;
  }

  portalSignInUrl(role: UserRole): string {
    const baseByRole: Partial<Record<UserRole, string>> = {
      customer: this.marketplaceUrl,
      dealer_agent: this.dealerUrl,
      credit_officer: this.creditUrl,
      finance_officer: this.financeUrl,
      admin: this.adminUrl,
      super_admin: this.superAdminUrl,
      group_admin: this.adminUrl,
    };
    const base = baseByRole[role] ?? this.marketplaceUrl;
    return `${base}/auth/sign-in`;
  }
}
