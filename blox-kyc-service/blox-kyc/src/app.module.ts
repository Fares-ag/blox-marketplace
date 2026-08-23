import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { KycModule } from './kyc/kyc.module';
import { HealthController } from './health.controller';
import { ServiceAuthGuard } from './common/auth/service-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    CryptoModule,
    KycModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ServiceAuthGuard }],
})
export class AppModule {}
