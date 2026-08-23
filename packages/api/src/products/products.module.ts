import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StorageModule } from '../storage/storage.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { InventoryBootstrapService } from './inventory-bootstrap.service';

@Module({
  imports: [CommonModule, StorageModule],
  controllers: [ProductsController],
  providers: [ProductsService, InventoryBootstrapService],
  exports: [ProductsService],
})
export class ProductsModule {}
