import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService onModuleInit', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('throws in production when S3_ENDPOINT is unset', async () => {
    process.env.NODE_ENV = 'production';
    const service = new StorageService({ get: () => undefined } as unknown as ConfigService);
    await expect(service.onModuleInit()).rejects.toThrow(/S3_ENDPOINT is required in production/);
  });

  it('throws in production when required bucket env vars are missing', async () => {
    process.env.NODE_ENV = 'production';
    const values: Record<string, string> = {
      S3_ENDPOINT: 'https://s3.example.com',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
      S3_BUCKET_LISTINGS: 'listing-images',
      S3_BUCKET_KYC: 'kyc-docs',
    };
    const service = new StorageService({
      get: (key: string) => values[key],
    } as unknown as ConfigService);
    await expect(service.onModuleInit()).rejects.toThrow(/S3_BUCKET_CONTRACTS/);
  });

  it('uses local fallback in non-production when S3_ENDPOINT is unset', async () => {
    process.env.NODE_ENV = 'development';
    const service = new StorageService({ get: () => undefined } as unknown as ConfigService);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
