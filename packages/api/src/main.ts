import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { createAuth } from './auth/auth';
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
  const handler = toNodeHandler(auth);

  // Express 5: named wildcard required (bare `*` throws PathError)
  expressApp.all('/api/auth/*path', (req: Request, res: Response) => handler(req, res));

  // Re-enable JSON body parser for Nest routes (auth handler reads its own body)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', { exclude: [] });

  // Expose auth instance for session lookups in guards
  app.get(AppModule);
  (global as { __dmAuth?: typeof auth }).__dmAuth = auth;

  const port = Number(config.get('API_PORT') ?? 3000);
  await app.listen(port);
  console.log(`DriveMarket API http://localhost:${port}`);
  console.log(`Better Auth   http://localhost:${port}/api/auth`);
}

void bootstrap();
