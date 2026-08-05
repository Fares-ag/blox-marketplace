import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StorageModule } from '../storage/storage.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [CommonModule, StorageModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
