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
    pathname.startsWith('/health') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/quotes/') ||
    pathname.startsWith('/payments/skipcash/') ||
    // Assisted-session customer links (/assist/<token>) are public and OTP-gated; /assist-sessions (staff) is not.
    pathname.startsWith('/assist/') ||
    pathname.startsWith('/product-rules')
  );
}

let redisClient: RedisClientType | undefined;

async function connectRedisRateLimitClient(redisUrl: string): Promise<RedisClientType> {
  const client = createClient({ url: redisUrl });
  client.on('error', (err) => {
    console.error('Redis rate-limit client error', err);
  });
  await client.connect();
  return client;
}

function createRedisStore(client: RedisClientType, prefix: string): RedisStore {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
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
  const rateLimitStore = config.get<string>('RATE_LIMIT_STORE')?.trim().toLowerCase();
  const redisUrl =
    rateLimitStore === 'memory' ? undefined : config.get<string>('REDIS_URL')?.trim();

  const base = {
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
  };

  if (redisUrl) {
    redisClient = await connectRedisRateLimitClient(redisUrl);
    const authLimiter: RequestHandler = rateLimit({
      ...base,
      max: authMax,
      store: createRedisStore(redisClient, 'auth'),
    });
    const publicLimiter: RequestHandler = rateLimit({
      ...base,
      max: publicMax,
      store: createRedisStore(redisClient, 'public'),
    });
    const globalLimiter: RequestHandler = rateLimit({
      ...base,
      max: globalMax,
      store: createRedisStore(redisClient, 'global'),
      skip: (req) => isStrictRateLimitPath(req.path),
    });

    expressApp.use('/api/auth', authLimiter);
    expressApp.use('/api/products', publicLimiter);
    expressApp.use('/api/quotes', publicLimiter);
    expressApp.use('/api/payments/skipcash', publicLimiter);
    expressApp.use('/api/assist', publicLimiter);
    expressApp.use('/api/product-rules', publicLimiter);
    expressApp.use('/api', globalLimiter);
    return;
  }

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
  expressApp.use('/api/assist', publicLimiter);
  expressApp.use('/api/product-rules', publicLimiter);
  expressApp.use('/api', globalLimiter);
}

export async function closeSecurityMiddlewareClients(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = undefined;
  }
}
