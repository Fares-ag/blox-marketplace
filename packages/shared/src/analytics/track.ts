import {
  sanitizeAnalyticsProps,
  type ProductAnalyticsEvent,
  type ProductAnalyticsProps,
} from './events';

/** Lightweight client-side product analytics (console in dev; opt-in in prod). */
export function trackProductEvent(
  event: ProductAnalyticsEvent,
  props: ProductAnalyticsProps = {},
): void {
  const enabled =
    import.meta.env.DEV || import.meta.env.VITE_PRODUCT_ANALYTICS === 'true';
  if (!enabled) return;

  const payload = {
    event,
    ...sanitizeAnalyticsProps(props),
    ts: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.info('[product-analytics]', payload);
  }
}
