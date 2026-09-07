"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_ROUTER = exports.NOTIFICATION_CHANNELS = exports.NOTIFICATION_CATEGORIES = void 0;
exports.resolveLocalizedText = resolveLocalizedText;
exports.isNotificationCategory = isNotificationCategory;
exports.inAppOnlyDispatchResult = inAppOnlyDispatchResult;
exports.NOTIFICATION_CATEGORIES = ['payments', 'documents', 'takaful', 'application', 'security'];
exports.NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'whatsapp', 'push'];
function resolveLocalizedText(value, locale) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string')
        return value;
    return (locale === 'ar' && value.ar) || value.en;
}
exports.NOTIFICATION_ROUTER = 'NOTIFICATION_ROUTER';
function isNotificationCategory(value) {
    return typeof value === 'string' && exports.NOTIFICATION_CATEGORIES.includes(value);
}
function inAppOnlyDispatchResult(notificationId, reason) {
    const skipped = { outcome: 'skipped', reason };
    return {
        notification_id: notificationId,
        channels: {
            in_app: notificationId ? { outcome: 'sent' } : skipped,
            email: skipped,
            sms: skipped,
            whatsapp: skipped,
            push: skipped,
        },
    };
}
//# sourceMappingURL=notification-router.contract.js.map