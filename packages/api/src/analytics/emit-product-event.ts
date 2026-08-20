import { Logger } from '@nestjs/common';
import {
  sanitizeAnalyticsProps,
  type ProductAnalyticsEvent,
  type ProductAnalyticsProps,
} from '../../../shared/src/analytics/events';

const logger = new Logger('ProductAnalytics');

/**
 * Framework-free sink used from Better Auth hooks and Nest services.
 * Replace the logger body with a real vendor sink when ready.
 */
export function emitProductEvent(
  event: ProductAnalyticsEvent,
  props: ProductAnalyticsProps = {},
): void {
  if (process.env.PRODUCT_ANALYTICS_ENABLED === 'false') return;
  const payload = {
    event,
    ...sanitizeAnalyticsProps(props),
    ts: new Date().toISOString(),
  };
  logger.log(JSON.stringify(payload));
}
