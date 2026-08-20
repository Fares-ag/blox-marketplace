import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';

export { SYSTEM_ACTOR, SYSTEM_ACTOR_USER_ID } from './system-actor';
export { ensureSystemUser, SYSTEM_USER_EMAIL } from './ensure-system-user';

@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class CommonModule {}
