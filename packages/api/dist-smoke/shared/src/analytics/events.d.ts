export declare const PRODUCT_ANALYTICS_EVENTS: readonly ["signup_started", "signup_completed", "application_started", "application_submitted", "document_uploaded", "approval", "rejection", "payment_started", "payment_completed"];
export type ProductAnalyticsEvent = (typeof PRODUCT_ANALYTICS_EVENTS)[number];
export type ProductAnalyticsProps = Record<string, string | number | boolean | null | undefined>;
export declare function sanitizeAnalyticsProps(props: ProductAnalyticsProps): ProductAnalyticsProps;
export declare function isProductAnalyticsEvent(value: string): value is ProductAnalyticsEvent;
