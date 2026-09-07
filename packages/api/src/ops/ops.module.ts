import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsController } from './ops.controller';
import { OriginationAnalyticsController } from './origination-analytics.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [OpsController, OriginationAnalyticsController],
})
export class OpsModule {}
