import type { ConfigService } from '@nestjs/config';
import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readLimitConfig(config: ConfigService) {
  const windowMs = parsePositiveInt(config.get<string>('RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000);
  return {
    windowMs,
    globalMax: parsePositiveInt(config.get<string>('RATE_LIMIT_MAX'), 300),
    authMax: parsePositiveInt(config.get<string>('RATE_LIMIT_AUTH_MAX'), 30),
    publicMax: parsePositiveInt(config.get<string>('RATE_LIMIT_PUBLIC_MAX'), 120),
  };
}

function isStrictRateLimitPath(pathname: string): boolean {
  return (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/quotes/') ||
    pathname.startsWith('/payments/skipcash/')
  );
}

/** Helmet + tiered express-rate-limit for the API surface. Skipped in test env. */
export function applySecurityMiddleware(expressApp: Express, config: ConfigService): void {
  expressApp.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  if (process.env.NODE_ENV === 'test') return;

  const { windowMs, globalMax, authMax, publicMax } = readLimitConfig(config);
  const base = {
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
  };

  const authLimiter: RequestHandler = rateLimit({ ...base, max: authMax });
  const publicLimiter: RequestHandler = rateLimit({ ...base, max: publicMax });
  const globalLimiter: RequestHandler = rateLimit({
    ...base,
    max: globalMax,
    skip: (req) => isStrictRateLimitPath(req.path),
  });

  expressApp.use('/api/auth', authLimiter);
  expressApp.use('/api/products', publicLimiter);
  expressApp.use('/api/quotes', publicLimiter);
  expressApp.use('/api/payments/skipcash', publicLimiter);
  expressApp.use('/api', globalLimiter);
}
