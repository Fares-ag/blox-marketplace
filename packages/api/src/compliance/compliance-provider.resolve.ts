import type { ConfigService } from '@nestjs/config';
import type { ComplianceProvider } from './compliance-provider.interface';
import { DevRecordedComplianceProvider } from './compliance-provider.dev';
import { StubComplianceProvider } from './compliance-provider.stub';

export type ComplianceProviderKind = 'stub' | 'synthetic';

/** True when COMPLIANCE_DEV_PROVIDER is set and NODE_ENV is not production. */
export function isComplianceDevProviderEnabled(config: ConfigService): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const flag = config.get<string>('COMPLIANCE_DEV_PROVIDER');
  return flag === 'true' || flag === '1';
}

/** Resolve which compliance backend is active (see COMPLIANCE_PROVIDER in .env.example). */
export function resolveComplianceProviderKind(config: ConfigService): ComplianceProviderKind {
  const explicit = config.get<string>('COMPLIANCE_PROVIDER')?.trim().toLowerCase();
  if (explicit === 'synthetic' || explicit === 'dev-recorded' || explicit === 'dev') {
    return 'synthetic';
  }
  if (explicit === 'stub') return 'stub';
  if (isComplianceDevProviderEnabled(config)) return 'synthetic';
  return 'stub';
}

export function resolveComplianceProvider(
  config: ConfigService,
  stub: StubComplianceProvider,
  dev: DevRecordedComplianceProvider,
): ComplianceProvider {
  return resolveComplianceProviderKind(config) === 'synthetic' ? dev : stub;
}
