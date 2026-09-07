import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CustomerDocumentsService } from './customer-documents.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

/** Customer profile and document vault (`/api/me/profile`, `/api/me/documents`, `/api/ops/customers/...`). */
@Module({
  imports: [CommonModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerDocumentsService],
  exports: [CustomersService, CustomerDocumentsService],
})
export class CustomersModule {}
