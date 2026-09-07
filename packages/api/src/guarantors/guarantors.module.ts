import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { KycPlatformClient } from '../kyc/kyc-platform.client';
import { GuarantorsController } from './guarantors.controller';
import { GuarantorsService } from './guarantors.service';

/**
 * Guarantor consent sessions (token + OTP + consents + optional KYC):
 * applicant/staff routes under /api/applications/:id/guarantor/session,
 * public token routes under /api/guarantor. The KYC platform client only
 * needs ConfigService, so it is provided here directly (KycModule exports
 * only the bridge, which is application-bound).
 */
@Module({
  imports: [CommonModule],
  controllers: [GuarantorsController],
  providers: [GuarantorsService, KycPlatformClient],
  exports: [GuarantorsService],
})
export class GuarantorsModule {}
