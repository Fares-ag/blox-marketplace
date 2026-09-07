import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import {
  resolveAuthBaseUrl,
  resolveAuthSecret,
  resolveCookieDomain,
  resolvePrivilegedLoginLockout,
  resolveRequireEmailVerification,
  resolveSessionCookieCacheMaxAge,
} from './auth-config';
import {
  isAccountLocked,
  lockoutMessage,
  recordFailedPrivilegedLogin,
  resetLoginLockout,
} from './login-lockout';
import { isMfaRequiredRole } from './privileged-roles';
import { emitProductEvent } from '../analytics/emit-product-event';
import { resolveSessionPolicy } from './session-policy';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email || null;
}

export function createAuth(prisma: PrismaService, config: ConfigService, mail: MailService) {
  const baseURL = resolveAuthBaseUrl(config);
  const secret = resolveAuthSecret(config);
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  const cookieDomain = resolveCookieDomain(config);
  const requireEmailVerification = resolveRequireEmailVerification(config);
  const sessionCookieCacheMaxAge = resolveSessionCookieCacheMaxAge(config);
  const loginLockout = resolvePrivilegedLoginLockout(config);
  const sessionPolicy = resolveSessionPolicy(config);
  mail.assertProductionReady(requireEmailVerification);

  return betterAuth({
    appName: 'Blox',
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
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
      // Completing a password reset proves control of the inbox. This is what
      // lets walk-in customers (created unverified, P0-4) into their account
      // when verification is required.
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
        // Captured at registration; normalised to en|ar in the sign-up hook below.
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
      // LOS FSD §11.2 idle timeout: a session expires `idleTimeoutSec` after its
      // last refresh, and any request older than `updateAge` refreshes it — so
      // an active user stays signed in while an abandoned tab does not. The
      // absolute ceiling and single-session rule live in SessionAuthGuard and
      // the `after` hook below.
      expiresIn: sessionPolicy.idleTimeoutSec,
      updateAge: Math.max(5, Math.min(60, Math.floor(sessionPolicy.idleTimeoutSec / 10))),
      // Short-lived in-process cache for session row reads. Authorization in
      // this API always re-loads User from Postgres in SessionAuthGuard.
      cookieCache: {
        enabled: sessionCookieCacheMaxAge > 0,
        maxAge: Math.min(sessionCookieCacheMaxAge, sessionPolicy.idleTimeoutSec),
      },
    },
    plugins: [
      twoFactor({
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
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') return;
        const email = normalizeEmail(ctx.body?.email);
        if (!email) return;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !isMfaRequiredRole(user.role)) return;
        if (!isAccountLocked(user)) return;

        throw APIError.from('FORBIDDEN', {
          message: lockoutMessage(user.lockedUntil),
          code: 'ACCOUNT_LOCKED',
        });
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Single session per user (LOS FSD §11.2): a new sign-in (including the
        // second factor of a 2FA sign-in) closes every other session. Mobile
        // bearer tokens are separate and unaffected.
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
          if (!user) return;
          if (user.preferredLanguage !== 'en' && user.preferredLanguage !== 'ar') {
            await prisma.user.update({
              where: { id: user.id },
              data: { preferredLanguage: 'en' },
            });
          }
          if (
            process.env.QA_SMOKE_AUTO_VERIFY === 'true' &&
            user.email.endsWith('@drivemarket.local')
          ) {
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: true },
            });
          }
          emitProductEvent('signup_completed', { role: user.role, source: 'email' });
          return;
        }

        if (ctx.path !== '/sign-in/email') return;
        const email = normalizeEmail(ctx.body?.email);
        if (!email) return;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !isMfaRequiredRole(user.role)) return;

        if (ctx.context.newSession?.user?.id === user.id) {
          await resetLoginLockout(prisma, user.id);
          return;
        }

        const returned = ctx.context.returned;
        if (isAPIError(returned) && returned.status === 'UNAUTHORIZED') {
          await recordFailedPrivilegedLogin(prisma, user.id, loginLockout);
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
              sameSite: 'lax' as const,
            },
          },
        }
      : process.env.NODE_ENV === 'production'
        ? {
            // Portals on *.blox.market calling a Railway *.railway.app host need
            // SameSite=None; host-only cookies (no COOKIE_DOMAIN) until api.blox.market
            // is attached to this service.
            advanced: {
              useSecureCookies: true,
              defaultCookieAttributes: {
                secure: true,
                sameSite: 'none' as const,
              },
            },
          }
        : {}),
  });
}

export type DmAuth = ReturnType<typeof createAuth>;
