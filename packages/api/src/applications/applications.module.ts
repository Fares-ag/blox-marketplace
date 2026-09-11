import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { KycModule } from '../kyc/kyc.module';
import { StorageModule } from '../storage/storage.module';
import { ZohoModule } from '../integrations/zoho/zoho.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationsStaffService } from './applications-staff.service';
import { ApplicationIntakeService } from './application-intake.service';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { MusharakahModule } from '../musharakah/musharakah.module';

@Module({
  imports: [CommonModule, ComplianceModule, KycModule, StorageModule, QuotesModule, ZohoModule, PaymentsModule, MusharakahModule],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsLifecycleService,
    ApplicationsStaffService,
    ApplicationIntakeService,
  ],
  exports: [ApplicationsService, ApplicationsStaffService, ApplicationIntakeService],
})
export class ApplicationsModule {}
