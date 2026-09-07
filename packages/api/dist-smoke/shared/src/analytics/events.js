"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_ANALYTICS_EVENTS = void 0;
exports.sanitizeAnalyticsProps = sanitizeAnalyticsProps;
exports.isProductAnalyticsEvent = isProductAnalyticsEvent;
exports.PRODUCT_ANALYTICS_EVENTS = [
    'signup_started',
    'signup_completed',
    'application_started',
    'application_submitted',
    'document_uploaded',
    'approval',
    'rejection',
    'payment_started',
    'payment_completed',
];
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
function sanitizeAnalyticsProps(props) {
    const out = {};
    for (const [key, value] of Object.entries(props)) {
        if (BLOCKED_PROP_KEYS.has(key.toLowerCase()))
            continue;
        if (typeof value === 'string' && value.includes('@'))
            continue;
        out[key] = value;
    }
    return out;
}
function isProductAnalyticsEvent(value) {
    return exports.PRODUCT_ANALYTICS_EVENTS.includes(value);
}
//# sourceMappingURL=events.js.map