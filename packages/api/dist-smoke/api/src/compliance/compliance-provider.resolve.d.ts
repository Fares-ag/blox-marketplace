import type { ConfigService } from '@nestjs/config';
import type { ComplianceProvider } from './compliance-provider.interface';
import { DevRecordedComplianceProvider } from './compliance-provider.dev';
import { StubComplianceProvider } from './compliance-provider.stub';
export type ComplianceProviderKind = 'stub' | 'synthetic';
export declare function isComplianceDevProviderEnabled(config: ConfigService): boolean;
export declare function resolveComplianceProviderKind(config: ConfigService): ComplianceProviderKind;
export declare function resolveComplianceProvider(config: ConfigService, stub: StubComplianceProvider, dev: DevRecordedComplianceProvider): ComplianceProvider;
