"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
const app_config_module_1 = require("./config/app-config.module");
const security_module_1 = require("./common/security.module");
const analytics_module_1 = require("./analytics/analytics.module");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const companies_module_1 = require("./companies/companies.module");
const offers_module_1 = require("./offers/offers.module");
const products_module_1 = require("./products/products.module");
const applications_module_1 = require("./applications/applications.module");
const storage_module_1 = require("./storage/storage.module");
const mail_module_1 = require("./mail/mail.module");
const payments_module_1 = require("./payments/payments.module");
const ops_module_1 = require("./ops/ops.module");
const quotes_module_1 = require("./quotes/quotes.module");
const finance_partners_module_1 = require("./finance-partners/finance-partners.module");
const notifications_module_1 = require("./notifications/notifications.module");
const jobs_module_1 = require("./jobs/jobs.module");
const schedule_1 = require("@nestjs/schedule");
const credits_module_1 = require("./credits/credits.module");
const catalog_module_1 = require("./catalog/catalog.module");
const kyc_module_1 = require("./kyc/kyc.module");
const mobile_module_1 = require("./mobile/mobile.module");
const media_module_1 = require("./media/media.module");
const settlements_module_1 = require("./settlements/settlements.module");
const consents_module_1 = require("./consents/consents.module");
const customers_module_1 = require("./customers/customers.module");
const takaful_module_1 = require("./takaful/takaful.module");
const assist_module_1 = require("./assist/assist.module");
const product_rules_module_1 = require("./product-rules/product-rules.module");
const guarantors_module_1 = require("./guarantors/guarantors.module");
const partner_module_1 = require("./partner/partner.module");
const push_module_1 = require("./push/push.module");
const health_controller_1 = require("./health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', '.env.local', '../../.env', '../../.env.local'],
            }),
            app_config_module_1.AppConfigModule,
            security_module_1.SecurityModule,
            schedule_1.ScheduleModule.forRoot(),
            analytics_module_1.AnalyticsModule,
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            mail_module_1.MailModule,
            storage_module_1.StorageModule,
            users_module_1.UsersModule,
            companies_module_1.CompaniesModule,
            offers_module_1.OffersModule,
            products_module_1.ProductsModule,
            applications_module_1.ApplicationsModule,
            payments_module_1.PaymentsModule,
            ops_module_1.OpsModule,
            quotes_module_1.QuotesModule,
            finance_partners_module_1.FinancePartnersModule,
            notifications_module_1.NotificationsModule,
            jobs_module_1.JobsModule,
            credits_module_1.CreditsModule,
            catalog_module_1.CatalogModule,
            kyc_module_1.KycModule,
            mobile_module_1.MobileModule,
            media_module_1.MediaModule,
            settlements_module_1.SettlementsModule,
            consents_module_1.ConsentsModule,
            customers_module_1.CustomersModule,
            takaful_module_1.TakafulModule,
            assist_module_1.AssistModule,
            product_rules_module_1.ProductRulesModule,
            guarantors_module_1.GuarantorsModule,
            partner_module_1.PartnerModule,
            push_module_1.PushModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [{ provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map