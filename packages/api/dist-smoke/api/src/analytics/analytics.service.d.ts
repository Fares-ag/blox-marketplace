import type { ProductAnalyticsEvent, ProductAnalyticsProps } from '../../../shared/src/analytics/events';
export declare class AnalyticsService {
    track(event: ProductAnalyticsEvent, props?: ProductAnalyticsProps): void;
}
