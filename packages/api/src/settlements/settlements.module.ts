import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MusharakahModule } from '../musharakah/musharakah.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [CommonModule, MusharakahModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
