import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConsentsModule } from '../consents/consents.module';
import { CustomerDocumentsService } from './customer-documents.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { DataRightsController } from './data-rights.controller';
import { DataRightsService } from './data-rights.service';

/**
 * Customer profile, document vault and data rights (`/api/me/profile`,
 * `/api/me/documents`, `/api/me/data-rights`, `/api/me/data-export`,
 * `/api/ops/customers/...`, `/api/ops/data-rights`).
 */
@Module({
  imports: [CommonModule, ConsentsModule],
  controllers: [CustomersController, DataRightsController],
  providers: [CustomersService, CustomerDocumentsService, DataRightsService],
  exports: [CustomersService, CustomerDocumentsService, DataRightsService],
})
export class CustomersModule {}
