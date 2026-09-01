import { NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ComplianceCheckStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { DevRecordedComplianceProvider } from './compliance-provider.dev';
import {
  isComplianceDevProviderEnabled,
  resolveComplianceProvider,
  resolveComplianceProviderKind,
} from './compliance-provider.resolve';
import { StubComplianceProvider } from './compliance-provider.stub';

describe('StubComplianceProvider', () => {
  const stub = new StubComplianceProvider();

  it('throws NotImplemented for vendor HTTP calls', async () => {
    await expect(stub.verifyIdentity('28412345678', 'Test User')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
    await expect(stub.screenSanctions('Test User')).rejects.toBeInstanceOf(NotImplementedException);
  });
});

describe('DevRecordedComplianceProvider', () => {
  const dev = new DevRecordedComplianceProvider();

  it('returns synthetic pass results for local runCheck flows', async () => {
    const identity = await dev.verifyIdentity('28412345678', 'Test User');
    const sanctions = await dev.screenSanctions('Test User');
    expect(identity.status).toBe(ComplianceCheckStatus.pass);
    expect(sanctions.status).toBe(ComplianceCheckStatus.pass);
    expect(identity.raw.synthetic).toBe(true);
  });
});

describe('resolveComplianceProvider', () => {
  const stub = new StubComplianceProvider();
  const devProvider = new DevRecordedComplianceProvider();

  function configWith(env: Record<string, string | undefined>) {
    const merged = { ...process.env, ...env };
    return {
      get: (key: string) => merged[key],
    } as unknown as ConfigService;
  }

  it('uses the stub in production when COMPLIANCE_PROVIDER is unset', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const config = configWith({ COMPLIANCE_DEV_PROVIDER: 'true', COMPLIANCE_PROVIDER: undefined });
      expect(isComplianceDevProviderEnabled(config)).toBe(false);
      expect(resolveComplianceProviderKind(config)).toBe('stub');
      expect(resolveComplianceProvider(config, stub, devProvider)).toBe(stub);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('uses synthetic in production when COMPLIANCE_PROVIDER=synthetic', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const config = configWith({ COMPLIANCE_PROVIDER: 'synthetic' });
      expect(resolveComplianceProviderKind(config)).toBe('synthetic');
      expect(resolveComplianceProvider(config, stub, devProvider)).toBe(devProvider);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('uses the dev provider when COMPLIANCE_DEV_PROVIDER is true outside production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const config = configWith({ COMPLIANCE_DEV_PROVIDER: 'true' });
      expect(isComplianceDevProviderEnabled(config)).toBe(true);
      expect(resolveComplianceProviderKind(config)).toBe('synthetic');
      expect(resolveComplianceProvider(config, stub, devProvider)).toBe(devProvider);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('defaults to the stub when the dev flag is unset', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const config = configWith({ COMPLIANCE_DEV_PROVIDER: undefined });
      expect(resolveComplianceProvider(config, stub, devProvider)).toBe(stub);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
