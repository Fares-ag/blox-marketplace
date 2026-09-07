import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TakafulProvidersController } from './takaful-providers.controller';
import { TakafulProvidersService } from './takaful-providers.service';
import { TakafulController } from './takaful.controller';
import { TakafulService } from './takaful.service';

/** Takaful declarations and policies on applications (customer + ops verification) and the provider quote master. */
@Module({
  imports: [CommonModule],
  controllers: [TakafulController, TakafulProvidersController],
  providers: [TakafulService, TakafulProvidersService],
  exports: [TakafulService, TakafulProvidersService],
})
export class TakafulModule {}
