import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CompaniesController } from './companies.controller';

@Module({ imports: [CommonModule], controllers: [CompaniesController] })
export class CompaniesModule {}
