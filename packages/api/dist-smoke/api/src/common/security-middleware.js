"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySecurityMiddleware = applySecurityMiddleware;
exports.closeSecurityMiddlewareClients = closeSecurityMiddlewareClients;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const helmet_1 = __importDefault(require("helmet"));
const redis_1 = require("redis");
function parsePositiveInt(raw, fallback) {
    if (!raw?.trim())
        return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
function readLimitConfig(config) {
    const windowMs = parsePositiveInt(config.get('RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000);
    return {
        windowMs,
        globalMax: parsePositiveInt(config.get('RATE_LIMIT_MAX'), 300),
        authMax: parsePositiveInt(config.get('RATE_LIMIT_AUTH_MAX'), 30),
        publicMax: parsePositiveInt(config.get('RATE_LIMIT_PUBLIC_MAX'), 120),
    };
}
function isStrictRateLimitPath(pathname) {
    return (pathname.startsWith('/auth') ||
        pathname.startsWith('/health') ||
        pathname.startsWith('/products') ||
        pathname.startsWith('/quotes/') ||
        pathname.startsWith('/payments/skipcash/') ||
        pathname.startsWith('/assist/') ||
        pathname.startsWith('/guarantor/') ||
        pathname.startsWith('/takaful/providers') ||
        pathname.startsWith('/product-rules'));
}
const PUBLIC_LIMITER_PREFIXES = [
    '/api/products',
    '/api/quotes',
    '/api/payments/skipcash',
    '/api/assist',
    '/api/guarantor',
    '/api/takaful/providers',
    '/api/product-rules',
];
let redisClient;
async function connectRedisRateLimitClient(redisUrl) {
    const client = (0, redis_1.createClient)({ url: redisUrl });
    client.on('error', (err) => {
        console.error('Redis rate-limit client error', err);
    });
    await client.connect();
    return client;
}
function createRedisStore(client, prefix) {
    return new rate_limit_redis_1.RedisStore({
        prefix: `rl:${prefix}:`,
        sendCommand: (...args) => client.sendCommand(args),
    });
}
async function applySecurityMiddleware(expressApp, config) {
    expressApp.use((0, helmet_1.default)({
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
    }));
    if (process.env.NODE_ENV === 'test')
        return;
    const { windowMs, globalMax, authMax, publicMax } = readLimitConfig(config);
    const rateLimitStore = config.get('RATE_LIMIT_STORE')?.trim().toLowerCase();
    const redisUrl = rateLimitStore === 'memory' ? undefined : config.get('REDIS_URL')?.trim();
    const base = {
        windowMs,
        standardHeaders: true,
        legacyHeaders: false,
    };
    if (redisUrl) {
        redisClient = await connectRedisRateLimitClient(redisUrl);
        const authLimiter = (0, express_rate_limit_1.default)({
            ...base,
            max: authMax,
            store: createRedisStore(redisClient, 'auth'),
        });
        const publicLimiter = (0, express_rate_limit_1.default)({
            ...base,
            max: publicMax,
            store: createRedisStore(redisClient, 'public'),
        });
        const globalLimiter = (0, express_rate_limit_1.default)({
            ...base,
            max: globalMax,
            store: createRedisStore(redisClient, 'global'),
            skip: (req) => isStrictRateLimitPath(req.path),
        });
        expressApp.use('/api/auth', authLimiter);
        for (const prefix of PUBLIC_LIMITER_PREFIXES)
            expressApp.use(prefix, publicLimiter);
        expressApp.use('/api', globalLimiter);
        return;
    }
    const authLimiter = (0, express_rate_limit_1.default)({ ...base, max: authMax });
    const publicLimiter = (0, express_rate_limit_1.default)({ ...base, max: publicMax });
    const globalLimiter = (0, express_rate_limit_1.default)({
        ...base,
        max: globalMax,
        skip: (req) => isStrictRateLimitPath(req.path),
    });
    expressApp.use('/api/auth', authLimiter);
    for (const prefix of PUBLIC_LIMITER_PREFIXES)
        expressApp.use(prefix, publicLimiter);
    expressApp.use('/api', globalLimiter);
}
async function closeSecurityMiddlewareClients() {
    if (redisClient?.isOpen) {
        await redisClient.quit();
        redisClient = undefined;
    }
}
//# sourceMappingURL=security-middleware.js.map