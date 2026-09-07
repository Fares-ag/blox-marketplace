import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { IdentityService } from './identity.service';
import { SmsService } from '../sms/sms.service';

/** Field encryption, blind indexes, QID handling and outbound SMS — available everywhere without imports. */
@Global()
@Module({
  providers: [EncryptionService, IdentityService, SmsService],
  exports: [EncryptionService, IdentityService, SmsService],
})
export class SecurityModule {}
