import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { BureauReportingController } from './bureau-reporting.controller';
import { BureauReportingService } from './bureau-reporting.service';

@Module({
  imports: [CommonModule],
  controllers: [BureauReportingController],
  providers: [BureauReportingService],
  exports: [BureauReportingService],
})
export class BureauReportingModule {}
