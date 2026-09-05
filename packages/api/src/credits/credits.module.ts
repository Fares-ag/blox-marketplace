import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CreditsController, OpsCreditsController, OpsCreditsListController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [CommonModule],
  controllers: [CreditsController, OpsCreditsController, OpsCreditsListController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
