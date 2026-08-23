import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const cfg = loadConfig(); // fails closed in prod on missing secrets
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(`Blox KYC service on http://localhost:${cfg.port}/api`);
  void Reflector;
}

void bootstrap();
