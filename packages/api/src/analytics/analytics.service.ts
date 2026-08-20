import { Injectable } from '@nestjs/common';
import type { ProductAnalyticsEvent, ProductAnalyticsProps } from '../../../shared/src/analytics/events';
import { emitProductEvent } from './emit-product-event';

@Injectable()
export class AnalyticsService {
  track(event: ProductAnalyticsEvent, props: ProductAnalyticsProps = {}): void {
    emitProductEvent(event, props);
  }
}
