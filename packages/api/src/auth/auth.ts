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
        twoFactorEnabled: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      // Short-lived in-process cache for session row reads. Authorization in
      // this API always re-loads User from Postgres in SessionAuthGuard.
      cookieCache: {
        enabled: sessionCookieCacheMaxAge > 0,
        maxAge: sessionCookieCacheMaxAge,
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
        if (ctx.path === '/sign-up/email') {
          const userId = ctx.context.newSession?.user?.id;
          if (!userId) return;
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (!user) return;
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
      : {}),
  });
}

export type DmAuth = ReturnType<typeof createAuth>;
