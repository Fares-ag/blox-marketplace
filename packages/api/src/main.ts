import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { createAuth } from './auth/auth';
import { resolveApiPort } from './auth/auth-config';
import { applySecurityMiddleware } from './common/security-middleware';
import { applyRequestIdMiddleware, RequestIdLogger } from './common/request-id';
import { PrismaService } from './prisma/prisma.service';
import { MailService } from './mail/mail.service';
import { initApiSentry } from './observability/sentry';

initApiSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);
  const mail = app.get(MailService);

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  const auth = createAuth(prisma, config, mail);
  const expressApp = app.getHttpAdapter().getInstance();
  // Railway / reverse proxies set X-Forwarded-For; required for rate-limit + Better Auth IP.
  if (process.env.NODE_ENV === 'production') {
    expressApp.set('trust proxy', 1);
  }
  applyRequestIdMiddleware(expressApp);
  applySecurityMiddleware(expressApp, config);

  const handler = toNodeHandler(auth);

  // Express 5: named wildcard required (bare `*` throws PathError)
  expressApp.all('/api/auth/*path', (req: Request, res: Response) => handler(req, res));

  // Re-enable JSON body parser for Nest routes (auth handler reads its own body)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const multer = require('multer');
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));
  expressApp.use(
    (
      err: Error & { code?: string },
      _req: Request,
      res: Response,
      next: (error?: Error) => void,
    ) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ message: 'file_too_large', statusCode: 413 });
        return;
      }
      next(err);
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: [] });

  app.useLogger(new RequestIdLogger());

  // Expose auth instance for session lookups in guards
  app.get(AppModule);
  (global as { __dmAuth?: typeof auth }).__dmAuth = auth;

  const port = resolveApiPort(config);
  await app.listen(port);
  console.log(`DriveMarket API http://localhost:${port}`);
  console.log(`Better Auth   http://localhost:${port}/api/auth`);
}

void bootstrap();
