import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionAuthGuard } from './guards';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AuthModule {}
