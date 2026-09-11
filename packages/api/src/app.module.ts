import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppConfigModule } from './config/app-config.module';
import { SecurityModule } from './common/security.module';
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
import { CreditsModule } from './credits/credits.module';
import { CatalogModule } from './catalog/catalog.module';
import { KycModule } from './kyc/kyc.module';
import { MobileModule } from './mobile/mobile.module';
import { MediaModule } from './media/media.module';
import { SettlementsModule } from './settlements/settlements.module';
import { ConsentsModule } from './consents/consents.module';
import { CustomersModule } from './customers/customers.module';
import { TakafulModule } from './takaful/takaful.module';
import { AssistModule } from './assist/assist.module';
import { ProductRulesModule } from './product-rules/product-rules.module';
import { GuarantorsModule } from './guarantors/guarantors.module';
import { PartnerModule } from './partner/partner.module';
import { PushModule } from './push/push.module';
import { HealthController } from './health.controller';
import { MusharakahModule } from './musharakah/musharakah.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '../../.env', '../../.env.local'],
    }),
    AppConfigModule,
    SecurityModule,
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
    MusharakahModule,
    OpsModule,
    QuotesModule,
    FinancePartnersModule,
    NotificationsModule,
    JobsModule,
    CreditsModule,
    CatalogModule,
    KycModule,
    MobileModule,
    MediaModule,
    SettlementsModule,
    ConsentsModule,
    CustomersModule,
    TakafulModule,
    AssistModule,
    ProductRulesModule,
    GuarantorsModule,
    PartnerModule,
    PushModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
