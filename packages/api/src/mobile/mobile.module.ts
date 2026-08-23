import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { CreditsModule } from '../credits/credits.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [ApplicationsModule, ProductsModule, CreditsModule, PaymentsModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
