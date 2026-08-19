import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import {
  resolveAuthBaseUrl,
  resolveAuthSecret,
  resolveCookieDomain,
  resolveRequireEmailVerification,
} from './auth-config';

export function createAuth(prisma: PrismaService, config: ConfigService, mail: MailService) {
  const baseURL = resolveAuthBaseUrl(config);
  const secret = resolveAuthSecret(config);
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  const cookieDomain = resolveCookieDomain(config);
  const requireEmailVerification = resolveRequireEmailVerification(config);
  mail.assertProductionReady(requireEmailVerification);

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      sendResetPassword: async ({ user, url }) => {
        await mail.sendPasswordResetEmail(user.email, url);
      },
      // Completing a password reset proves control of the inbox. This is what
      // lets walk-in customers (created unverified, P0-4) into their account
      // when verification is required.
      onPasswordReset: async ({ user }) => {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
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
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
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
