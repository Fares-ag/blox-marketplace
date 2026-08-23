import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { StorageModule } from '../storage/storage.module';
import { ZohoModule } from '../integrations/zoho/zoho.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationsStaffService } from './applications-staff.service';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
  imports: [CommonModule, ComplianceModule, StorageModule, QuotesModule, ZohoModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsLifecycleService, ApplicationsStaffService],
  exports: [ApplicationsService, ApplicationsStaffService],
})
export class ApplicationsModule {}
