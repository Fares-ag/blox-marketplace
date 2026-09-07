"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFERENCES = void 0;
exports.resolveNotificationPreferences = resolveNotificationPreferences;
exports.mergeNotificationPreferences = mergeNotificationPreferences;
exports.reminderEnabled = reminderEnabled;
exports.channelEnabled = channelEnabled;
exports.DEFAULT_NOTIFICATION_PREFERENCES = {
    channels: { email: true, sms: true, push: true, whatsapp: false },
    reminders: { payments: true, documents: true, takaful: true },
};
function pickBooleans(defaults, raw) {
    const out = { ...defaults };
    if (raw && typeof raw === 'object') {
        for (const key of Object.keys(defaults)) {
            const value = raw[key];
            if (typeof value === 'boolean')
                out[key] = value;
        }
    }
    return out;
}
function resolveNotificationPreferences(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        channels: pickBooleans(exports.DEFAULT_NOTIFICATION_PREFERENCES.channels, source.channels),
        reminders: pickBooleans(exports.DEFAULT_NOTIFICATION_PREFERENCES.reminders, source.reminders),
    };
}
function mergeNotificationPreferences(current, patch) {
    const base = resolveNotificationPreferences(current);
    if (!patch)
        return base;
    return {
        channels: pickBooleans(base.channels, patch.channels),
        reminders: pickBooleans(base.reminders, patch.reminders),
    };
}
function reminderEnabled(raw, kind) {
    return resolveNotificationPreferences(raw).reminders[kind];
}
function channelEnabled(raw, channel) {
    return resolveNotificationPreferences(raw).channels[channel];
}
//# sourceMappingURL=notification-preferences.js.map