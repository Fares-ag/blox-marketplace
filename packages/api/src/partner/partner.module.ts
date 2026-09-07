import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { KycModule } from '../kyc/kyc.module';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

/** Read-only finance-provider (NBFC) view of applications tagged to that lender (`/api/partner/...`). */
@Module({
  imports: [CommonModule, KycModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
