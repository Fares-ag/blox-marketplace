import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { AppModule } from './app.module';
import { AUTH_INSTANCE } from './auth/auth.constants';
import { applySecurityMiddleware } from './common/security-middleware';
import { applyRequestIdMiddleware, RequestIdLogger } from './common/request-id';
import { applyMulterErrorMiddleware } from './common/multer-error.middleware';
import { initApiSentry } from './observability/sentry';
import { AppConfigService } from './config/app-config.service';
import { StorageService } from './storage/storage.service';
import { serveListingImageRequest } from './media/listing-image.handler';
import { serveCatalogImageRequest } from './media/catalog-image.handler';

initApiSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const appConfig = app.get(AppConfigService);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
  });

  const auth = app.get(AUTH_INSTANCE);
  const expressApp = app.getHttpAdapter().getInstance();
  // Railway / reverse proxies set X-Forwarded-For; required for rate-limit + Better Auth IP.
  if (process.env.NODE_ENV === 'production') {
    expressApp.set('trust proxy', 1);
  }
  applyRequestIdMiddleware(expressApp);
  await applySecurityMiddleware(expressApp, config);

  const handler = toNodeHandler(auth);

  // Express 5: named wildcard required (bare `*` throws PathError)
  expressApp.all('/api/auth/*path', (req: Request, res: Response) => handler(req, res));

  const storage = app.get(StorageService);
  expressApp.get('/api/v1/media/listings/*path', (req: Request, res: Response, next: NextFunction) => {
    void serveListingImageRequest(storage, req, res).catch(next);
  });
  expressApp.get('/api/v1/media/catalog/:filename', (req: Request, res: Response, next: NextFunction) => {
    void serveCatalogImageRequest(req, res).catch(next);
  });

  // Re-enable JSON body parser for Nest routes (auth handler reads its own body)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const multer = require('multer');
  expressApp.use(
    express.json({
      limit: '10mb',
      verify: (req: { rawBody?: string }, _res: unknown, buf: Buffer) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  expressApp.use(express.urlencoded({ extended: true }));
  // Local dev listing images (storage.service returns /uploads/{bucket}/{key})
  expressApp.use('/uploads', express.static(path.join(process.cwd(), '.uploads')));
  applyMulterErrorMiddleware(expressApp, multer);
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

  app.useLogger(new RequestIdLogger());

  const port = appConfig.apiPort;
  await app.listen(port);
  console.log(`DriveMarket API http://localhost:${port}`);
  console.log(`Better Auth   http://localhost:${port}/api/auth`);
}

void bootstrap();
