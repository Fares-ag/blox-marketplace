import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StorageModule } from '../storage/storage.module';
import { ZohoModule } from '../integrations/zoho/zoho.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
  imports: [CommonModule, StorageModule, QuotesModule, ZohoModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsLifecycleService],
})
export class ApplicationsModule {}
