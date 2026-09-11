import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MusharakahController } from './musharakah.controller';
import { MusharakahService } from './musharakah.service';

@Module({
  imports: [CommonModule],
  controllers: [MusharakahController],
  providers: [MusharakahService],
  exports: [MusharakahService],
})
export class MusharakahModule {}
