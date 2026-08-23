import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { IdempotencyService } from './idempotency.service';

export { SYSTEM_ACTOR, SYSTEM_ACTOR_USER_ID } from './system-actor';
export { ensureSystemUser, SYSTEM_USER_EMAIL } from './ensure-system-user';
export { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_SCOPES } from './idempotency.constants';

@Module({
  providers: [ActivityService, IdempotencyService],
  exports: [ActivityService, IdempotencyService],
})
export class CommonModule {}
