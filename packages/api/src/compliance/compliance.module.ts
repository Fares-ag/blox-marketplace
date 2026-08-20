import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { COMPLIANCE_PROVIDER } from './compliance-provider.interface';
import { DevRecordedComplianceProvider } from './compliance-provider.dev';
import { resolveComplianceProvider } from './compliance-provider.resolve';
import { StubComplianceProvider } from './compliance-provider.stub';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [PrismaModule, CommonModule, ConfigModule],
  providers: [
    ComplianceService,
    StubComplianceProvider,
    DevRecordedComplianceProvider,
    {
      provide: COMPLIANCE_PROVIDER,
      useFactory: (
        config: ConfigService,
        stub: StubComplianceProvider,
        dev: DevRecordedComplianceProvider,
      ) => resolveComplianceProvider(config, stub, dev),
      inject: [ConfigService, StubComplianceProvider, DevRecordedComplianceProvider],
    },
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
