import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ZohoModule } from '../integrations/zoho/zoho.module';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesModule } from '../quotes/quotes.module';
import { JobHealthService } from './job-health.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    CommonModule,
    PaymentsModule,
    QuotesModule,
    ZohoModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobHealthService],
  exports: [JobsService, JobHealthService],
})
export class JobsModule {}
