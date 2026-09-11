import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycBridgeService } from './kyc-bridge.service';
import { KycController } from './kyc.controller';
import { KycPlatformClient } from './kyc-platform.client';
import { MusharakahModule } from '../musharakah/musharakah.module';

@Module({
  imports: [ConfigModule, MusharakahModule],
  controllers: [KycController],
  providers: [KycPlatformClient, KycBridgeService],
  exports: [KycBridgeService],
})
export class KycModule {}
