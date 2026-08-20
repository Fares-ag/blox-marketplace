/** Privacy-safe product analytics taxonomy (no raw PII in payloads). */
export const PRODUCT_ANALYTICS_EVENTS = [
  'signup_started',
  'signup_completed',
  'application_started',
  'application_submitted',
  'document_uploaded',
  'approval',
  'rejection',
  'payment_started',
  'payment_completed',
] as const;

export type ProductAnalyticsEvent = (typeof PRODUCT_ANALYTICS_EVENTS)[number];

export type ProductAnalyticsProps = Record<string, string | number | boolean | null | undefined>;

const BLOCKED_PROP_KEYS = new Set([
  'email',
  'name',
  'full_name',
  'phone',
  'qid',
  'reason',
  'reference',
  'customer_email',
  'customer_name',
]);

/** Strip keys that commonly carry PII before emitting an event. */
export function sanitizeAnalyticsProps(props: ProductAnalyticsProps): ProductAnalyticsProps {
  const out: ProductAnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_PROP_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.includes('@')) continue;
    out[key] = value;
  }
  return out;
}

export function isProductAnalyticsEvent(value: string): value is ProductAnalyticsEvent {
  return (PRODUCT_ANALYTICS_EVENTS as readonly string[]).includes(value);
}
