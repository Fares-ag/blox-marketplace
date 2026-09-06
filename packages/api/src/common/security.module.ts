import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { SmsService } from '../sms/sms.service';

/** Field encryption, blind indexes and outbound SMS — available everywhere without imports. */
@Global()
@Module({
  providers: [EncryptionService, SmsService],
  exports: [EncryptionService, SmsService],
})
export class SecurityModule {}
