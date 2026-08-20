import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { createAuth } from './auth';
import { AUTH_INSTANCE } from './auth.constants';
import { OptionalSessionGuard, SessionAuthGuard } from './guards';
import { MeController } from './me.controller';

@Global()
@Module({
  imports: [PrismaModule, MailModule],
  controllers: [MeController],
  providers: [
    {
      provide: AUTH_INSTANCE,
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
        mail: MailService,
      ) => createAuth(prisma, config, mail),
      inject: [PrismaService, ConfigService, MailService],
    },
    OptionalSessionGuard,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
  exports: [AUTH_INSTANCE, OptionalSessionGuard],
})
export class AuthModule {}
