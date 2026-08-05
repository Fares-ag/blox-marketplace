import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';

export function createAuth(prisma: PrismaService, config: ConfigService) {
  const baseURL = config.get<string>('BETTER_AUTH_URL') ?? 'http://localhost:3000';
  const secret = config.get<string>('BETTER_AUTH_SECRET') ?? 'dev-secret-change-me';
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // enable in prod; gate apply in app later
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
  });
}

export type DmAuth = ReturnType<typeof createAuth>;
