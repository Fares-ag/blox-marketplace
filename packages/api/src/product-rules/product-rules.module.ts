import { Module } from '@nestjs/common';
import { ProductRulesController } from './product-rules.controller';

@Module({
  controllers: [ProductRulesController],
})
export class ProductRulesModule {}
