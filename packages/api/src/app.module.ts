import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { OffersModule } from './offers/offers.module';
import { ProductsModule } from './products/products.module';
import { ApplicationsModule } from './applications/applications.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { PaymentsModule } from './payments/payments.module';
import { OpsModule } from './ops/ops.module';
import { QuotesModule } from './quotes/quotes.module';
import { FinancePartnersModule } from './finance-partners/finance-partners.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    AnalyticsModule,
    PrismaModule,
    AuthModule,
    MailModule,
    StorageModule,
    UsersModule,
    CompaniesModule,
    OffersModule,
    ProductsModule,
    ApplicationsModule,
    PaymentsModule,
    OpsModule,
    QuotesModule,
    FinancePartnersModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
