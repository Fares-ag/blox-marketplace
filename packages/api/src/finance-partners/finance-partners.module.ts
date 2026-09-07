import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancePartnersController } from './finance-partners.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [FinancePartnersController],
})
export class FinancePartnersModule {}
