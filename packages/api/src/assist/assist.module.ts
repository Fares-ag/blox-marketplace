import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConsentsModule } from '../consents/consents.module';
import { KycModule } from '../kyc/kyc.module';
import { AssistController } from './assist.controller';
import { AssistService } from './assist.service';

/** Sales-executive assisted sessions: staff routes under /api/assist-sessions, public token routes under /api/assist. */
@Module({
  imports: [CommonModule, ConsentsModule, KycModule],
  controllers: [AssistController],
  providers: [AssistService],
  exports: [AssistService],
})
export class AssistModule {}
