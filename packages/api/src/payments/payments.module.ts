import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { CreditsModule } from '../credits/credits.module';
import { MusharakahModule } from '../musharakah/musharakah.module';
import { CustomerPaymentsController } from './customer-payments.controller';
import { CustomerPaymentsService } from './customer-payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [CommonModule, ConfigModule, CreditsModule, MusharakahModule],
  controllers: [PaymentsController, CustomerPaymentsController],
  providers: [PaymentsService, CustomerPaymentsService],
  exports: [PaymentsService, CustomerPaymentsService],
})
export class PaymentsModule {}
