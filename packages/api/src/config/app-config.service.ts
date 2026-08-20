import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveApiPort, resolveAuthSecret } from '../auth/auth-config';

function requireNonEmpty(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function parseOrigins(raw: string | undefined, fallback: string): string[] {
  return (raw ?? fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Validated, typed view of process env — constructed once at boot. */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  readonly nodeEnv: string;
  readonly apiPort: number;
  readonly corsOrigins: string[];
  readonly marketplaceUrl: string;
  readonly databaseUrl: string;

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

    this.databaseUrl = requireNonEmpty(config.get<string>('DATABASE_URL'), 'DATABASE_URL');

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
}
