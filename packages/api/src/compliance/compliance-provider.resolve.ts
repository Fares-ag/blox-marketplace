import type { ConfigService } from '@nestjs/config';
import type { ComplianceProvider } from './compliance-provider.interface';
import { DevRecordedComplianceProvider } from './compliance-provider.dev';
import { StubComplianceProvider } from './compliance-provider.stub';

/** True when COMPLIANCE_DEV_PROVIDER is set and NODE_ENV is not production. */
export function isComplianceDevProviderEnabled(config: ConfigService): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const flag = config.get<string>('COMPLIANCE_DEV_PROVIDER');
  return flag === 'true' || flag === '1';
}

export function resolveComplianceProvider(
  config: ConfigService,
  stub: StubComplianceProvider,
  dev: DevRecordedComplianceProvider,
): ComplianceProvider {
  return isComplianceDevProviderEnabled(config) ? dev : stub;
}
