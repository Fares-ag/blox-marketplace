import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycBridgeService } from './kyc-bridge.service';
import { KycController } from './kyc.controller';
import { KycPlatformClient } from './kyc-platform.client';

@Module({
  imports: [ConfigModule],
  controllers: [KycController],
  providers: [KycPlatformClient, KycBridgeService],
  exports: [KycBridgeService],
})
export class KycModule {}
