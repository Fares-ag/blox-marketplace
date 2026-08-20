import type { ConfigService } from '@nestjs/config';
import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import helmet from 'helmet';
import { createClient, type RedisClientType } from 'redis';

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

let redisClient: RedisClientType | undefined;

async function createSharedRateLimitStore(redisUrl: string) {
  const client = createClient({ url: redisUrl });
  client.on('error', (err) => {
    console.error('Redis rate-limit client error', err);
  });
  await client.connect();
  redisClient = client;
  return new RedisStore({
    sendCommand: (...args: string[]) => client.sendCommand(args),
  });
}

/** Helmet + tiered express-rate-limit for the API surface. Skipped in test env. */
export async function applySecurityMiddleware(
  expressApp: Express,
  config: ConfigService,
): Promise<void> {
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
  const redisUrl = config.get<string>('REDIS_URL')?.trim();
  const store = redisUrl ? await createSharedRateLimitStore(redisUrl) : undefined;

  const base = {
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    ...(store ? { store } : {}),
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

export async function closeSecurityMiddlewareClients(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = undefined;
  }
}
