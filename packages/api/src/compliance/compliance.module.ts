import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { COMPLIANCE_PROVIDER } from './compliance-provider.interface';
import { StubComplianceProvider } from './compliance-provider.stub';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [
    ComplianceService,
    StubComplianceProvider,
    {
      provide: COMPLIANCE_PROVIDER,
      useExisting: StubComplianceProvider,
    },
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
