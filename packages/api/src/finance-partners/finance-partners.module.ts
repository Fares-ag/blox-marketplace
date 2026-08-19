import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancePartnersController } from './finance-partners.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FinancePartnersController],
})
export class FinancePartnersModule {}
