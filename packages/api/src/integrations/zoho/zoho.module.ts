import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { ZohoAuthService } from './zoho-auth.service';
import { ZohoConfig } from './zoho-config';
import { ZohoCrmService } from './zoho-crm.service';

@Module({
  imports: [ConfigModule, PrismaModule, CommonModule, StorageModule],
  providers: [ZohoConfig, ZohoAuthService, ZohoCrmService],
  exports: [ZohoCrmService, ZohoConfig],
})
export class ZohoModule {}
