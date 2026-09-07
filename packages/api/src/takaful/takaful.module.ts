import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TakafulController } from './takaful.controller';
import { TakafulService } from './takaful.service';

/** Takaful declarations and policies on applications (customer + ops verification). */
@Module({
  imports: [CommonModule],
  controllers: [TakafulController],
  providers: [TakafulService],
  exports: [TakafulService],
})
export class TakafulModule {}
