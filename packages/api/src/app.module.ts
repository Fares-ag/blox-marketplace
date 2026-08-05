import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { OffersModule } from './offers/offers.module';
import { ProductsModule } from './products/products.module';
import { ApplicationsModule } from './applications/applications.module';
import { StorageModule } from './storage/storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    StorageModule,
    UsersModule,
    CompaniesModule,
    OffersModule,
    ProductsModule,
    ApplicationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
