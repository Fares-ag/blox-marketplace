import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { createAuth } from '../../../src/auth/auth';
import { MailService } from '../../../src/mail/mail.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { applyIntegrationEnv } from './env';
import { applySecurityMiddleware } from '../../../src/common/security-middleware';
import { applyRequestIdMiddleware } from '../../../src/common/request-id';

export type IntegrationAgent = ReturnType<typeof request.agent>;

export type IntegrationContext = {
  app: INestApplication;
  prisma: PrismaService;
  agent: IntegrationAgent;
};

export async function createIntegrationApp(
  envOverrides: Record<string, string | undefined> = {},
): Promise<IntegrationContext> {
  applyIntegrationEnv(envOverrides);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue({
      assertProductionReady: () => undefined,
      enabled: false,
      send: async () => undefined,
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
      sendWalkInInviteEmail: async () => undefined,
      processOutbox: async () => ({ processed: 0, sent: 0, failed: 0 }),
      markForRetry: async () => undefined,
    } satisfies Partial<MailService>)
    .compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });
  const prisma = app.get(PrismaService);
  const mail = app.get(MailService);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: [process.env.CORS_ORIGINS ?? 'http://localhost:5173'],
    credentials: true,
  });

  const auth = createAuth(prisma, config, mail);
  const expressApp = app.getHttpAdapter().getInstance();
  applyRequestIdMiddleware(expressApp);
  applySecurityMiddleware(expressApp, config);
  const handler = toNodeHandler(auth);
  expressApp.all('/api/auth/*path', (req: Request, res: Response) => handler(req, res));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: [] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  (global as { __dmAuth?: typeof auth }).__dmAuth = auth;

  await app.init();

  return {
    app,
    prisma,
    agent: request.agent(app.getHttpServer()),
  };
}

/** Cookie-aware supertest agent for a single user/session in a test. */
export function createAgent(ctx: IntegrationContext): IntegrationAgent {
  return request.agent(ctx.app.getHttpServer());
}

export async function destroyIntegrationApp(ctx: IntegrationContext | undefined) {
  (global as { __dmAuth?: unknown }).__dmAuth = undefined;
  if (ctx?.app) await ctx.app.close();
}
