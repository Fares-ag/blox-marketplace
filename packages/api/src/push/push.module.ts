import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from './push.service';

/** Push notifications (FCM HTTP v1) to registered device tokens. */
@Module({
  imports: [PrismaModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
