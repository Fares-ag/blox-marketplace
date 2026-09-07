"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuth = createAuth;
const better_auth_1 = require("better-auth");
const prisma_1 = require("better-auth/adapters/prisma");
const api_1 = require("better-auth/api");
const plugins_1 = require("better-auth/plugins");
const auth_config_1 = require("./auth-config");
const login_lockout_1 = require("./login-lockout");
const privileged_roles_1 = require("./privileged-roles");
const emit_product_event_1 = require("../analytics/emit-product-event");
const session_policy_1 = require("./session-policy");
function normalizeEmail(value) {
    if (typeof value !== 'string')
        return null;
    const email = value.trim().toLowerCase();
    return email || null;
}
function createAuth(prisma, config, mail) {
    const baseURL = (0, auth_config_1.resolveAuthBaseUrl)(config);
    const secret = (0, auth_config_1.resolveAuthSecret)(config);
    const origins = (config.get('CORS_ORIGINS') ?? 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim());
    const cookieDomain = (0, auth_config_1.resolveCookieDomain)(config);
    const requireEmailVerification = (0, auth_config_1.resolveRequireEmailVerification)(config);
    const sessionCookieCacheMaxAge = (0, auth_config_1.resolveSessionCookieCacheMaxAge)(config);
    const loginLockout = (0, auth_config_1.resolvePrivilegedLoginLockout)(config);
    const sessionPolicy = (0, session_policy_1.resolveSessionPolicy)(config);
    mail.assertProductionReady(requireEmailVerification);
    return (0, better_auth_1.betterAuth)({
        appName: 'Blox',
        database: (0, prisma_1.prismaAdapter)(prisma, { provider: 'postgresql' }),
        secret,
        baseURL,
        basePath: '/api/auth',
        trustedOrigins: origins,
        emailAndPassword: {
            enabled: true,
            requireEmailVerification,
            revokeSessionsOnPasswordReset: true,
            sendResetPassword: async ({ user, url }) => {
                await mail.sendPasswordResetEmail(user.email, url);
            },
            onPasswordReset: async ({ user }) => {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        failedLoginAttempts: 0,
                        lockedUntil: null,
                    },
                });
            },
        },
        emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user, url }) => {
                await mail.sendVerificationEmail(user.email, url);
            },
        },
        user: {
            additionalFields: {
                role: {
                    type: 'string',
                    required: false,
                    defaultValue: 'customer',
                    input: false,
                },
                companyId: {
                    type: 'string',
                    required: false,
                    input: false,
                },
                phone: {
                    type: 'string',
                    required: false,
                    input: true,
                },
                qid: {
                    type: 'string',
                    required: false,
                    input: true,
                },
                preferredLanguage: {
                    type: 'string',
                    required: false,
                    defaultValue: 'en',
                    input: true,
                },
                twoFactorEnabled: {
                    type: 'boolean',
                    required: false,
                    defaultValue: false,
                    input: false,
                },
            },
        },
        session: {
            expiresIn: sessionPolicy.idleTimeoutSec,
            updateAge: Math.max(5, Math.min(60, Math.floor(sessionPolicy.idleTimeoutSec / 10))),
            cookieCache: {
                enabled: sessionCookieCacheMaxAge > 0,
                maxAge: Math.min(sessionCookieCacheMaxAge, sessionPolicy.idleTimeoutSec),
            },
        },
        plugins: [
            (0, plugins_1.twoFactor)({
                issuer: 'Blox',
                totpOptions: {
                    digits: 6,
                    period: 30,
                },
                accountLockout: {
                    enabled: true,
                    maxFailedAttempts: 10,
                    durationSeconds: loginLockout.lockoutDurationSeconds,
                },
            }),
        ],
        hooks: {
            before: (0, api_1.createAuthMiddleware)(async (ctx) => {
                if (ctx.path !== '/sign-in/email')
                    return;
                const email = normalizeEmail(ctx.body?.email);
                if (!email)
                    return;
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user || !(0, privileged_roles_1.isMfaRequiredRole)(user.role))
                    return;
                if (!(0, login_lockout_1.isAccountLocked)(user))
                    return;
                throw api_1.APIError.from('FORBIDDEN', {
                    message: (0, login_lockout_1.lockoutMessage)(user.lockedUntil),
                    code: 'ACCOUNT_LOCKED',
                });
            }),
            after: (0, api_1.createAuthMiddleware)(async (ctx) => {
                const newSession = ctx.context.newSession;
                if (sessionPolicy.singleSession && newSession?.session?.id && newSession.user?.id) {
                    await prisma.session.deleteMany({
                        where: { userId: newSession.user.id, id: { not: newSession.session.id } },
                    });
                }
                if (ctx.path === '/sign-up/email') {
                    const email = normalizeEmail(ctx.body?.email);
                    const sessionUserId = ctx.context.newSession?.user?.id;
                    const user = sessionUserId
                        ? await prisma.user.findUnique({ where: { id: sessionUserId } })
                        : email
                            ? await prisma.user.findUnique({ where: { email } })
                            : null;
                    if (!user)
                        return;
                    if (user.preferredLanguage !== 'en' && user.preferredLanguage !== 'ar') {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { preferredLanguage: 'en' },
                        });
                    }
                    if (process.env.QA_SMOKE_AUTO_VERIFY === 'true' &&
                        user.email.endsWith('@drivemarket.local')) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { emailVerified: true },
                        });
                    }
                    (0, emit_product_event_1.emitProductEvent)('signup_completed', { role: user.role, source: 'email' });
                    return;
                }
                if (ctx.path !== '/sign-in/email')
                    return;
                const email = normalizeEmail(ctx.body?.email);
                if (!email)
                    return;
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user || !(0, privileged_roles_1.isMfaRequiredRole)(user.role))
                    return;
                if (ctx.context.newSession?.user?.id === user.id) {
                    await (0, login_lockout_1.resetLoginLockout)(prisma, user.id);
                    return;
                }
                const returned = ctx.context.returned;
                if ((0, api_1.isAPIError)(returned) && returned.status === 'UNAUTHORIZED') {
                    await (0, login_lockout_1.recordFailedPrivilegedLogin)(prisma, user.id, loginLockout);
                }
            }),
        },
        ...(cookieDomain
            ? {
                advanced: {
                    useSecureCookies: true,
                    crossSubDomainCookies: {
                        enabled: true,
                        domain: cookieDomain,
                    },
                    defaultCookieAttributes: {
                        secure: true,
                        sameSite: 'lax',
                    },
                },
            }
            : process.env.NODE_ENV === 'production'
                ? {
                    advanced: {
                        useSecureCookies: true,
                        defaultCookieAttributes: {
                            secure: true,
                            sameSite: 'none',
                        },
                    },
                }
                : {}),
    });
}
//# sourceMappingURL=auth.js.map