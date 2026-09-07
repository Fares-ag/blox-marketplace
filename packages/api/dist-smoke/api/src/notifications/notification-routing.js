"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REMINDER_CATEGORIES = exports.OUTBOUND_CHANNELS = void 0;
exports.selectNotificationChannels = selectNotificationChannels;
exports.parseOutboundChannels = parseOutboundChannels;
exports.truncateText = truncateText;
exports.notificationSmsText = notificationSmsText;
exports.notificationWhatsAppText = notificationWhatsAppText;
exports.portalBaseForRole = portalBaseForRole;
exports.absoluteNotificationUrl = absoluteNotificationUrl;
exports.dispatchSummary = dispatchSummary;
const notification_texts_1 = require("./notification-texts");
exports.OUTBOUND_CHANNELS = ['email', 'sms', 'whatsapp', 'push'];
exports.REMINDER_CATEGORIES = ['payments', 'documents', 'takaful'];
function hasContact(channel, contact) {
    switch (channel) {
        case 'email':
            return Boolean(contact.email?.trim());
        case 'sms':
        case 'whatsapp':
            return Boolean(contact.phone?.trim());
        case 'push':
            return contact.deviceTokens > 0;
    }
}
function reminderSwitchedOff(input) {
    if (!exports.REMINDER_CATEGORIES.includes(input.category))
        return false;
    const key = input.category;
    return input.preferences.reminders[key] === false;
}
function selectNotificationChannels(input) {
    const decisions = {};
    const reminderOff = reminderSwitchedOff(input);
    const security = input.category === 'security';
    for (const channel of exports.OUTBOUND_CHANNELS) {
        const forced = security && channel === 'email';
        if (input.active === false) {
            decisions[channel] = { send: false, reason: 'user_inactive' };
        }
        else if (reminderOff) {
            decisions[channel] = { send: false, reason: 'reminder_off' };
        }
        else if (!forced && !input.preferences.channels[channel]) {
            decisions[channel] = { send: false, reason: 'preference_off' };
        }
        else if (!hasContact(channel, input.contact)) {
            decisions[channel] = { send: false, reason: 'no_contact' };
        }
        else if (!input.providers[channel]) {
            decisions[channel] = { send: false, reason: 'provider_disabled' };
        }
        else {
            decisions[channel] = { send: true, forced };
        }
    }
    return decisions;
}
function parseOutboundChannels(raw) {
    const trimmed = raw?.trim();
    if (!trimmed)
        return new Set(exports.OUTBOUND_CHANNELS);
    const enabled = new Set();
    for (const part of trimmed.split(',')) {
        const key = part.trim().toLowerCase();
        if (exports.OUTBOUND_CHANNELS.includes(key))
            enabled.add(key);
    }
    return enabled;
}
function truncateText(text, maxChars) {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars)
        return trimmed;
    return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
function notificationSmsText(input, maxChars = 480) {
    const locale = input.locale ?? 'en';
    const url = input.url?.trim() || '';
    const link = url && locale === 'ar' ? (0, notification_texts_1.isolateLtr)(url) : url;
    const head = [input.title.trim(), input.body?.trim() || ''].filter(Boolean).join(' — ');
    const budget = link ? maxChars - link.length - 1 : maxChars;
    const text = truncateText(head, Math.max(40, budget));
    return (0, notification_texts_1.finalizeText)(link ? `${text} ${link}` : text, locale);
}
function notificationWhatsAppText(input, maxChars = 1024) {
    const locale = input.locale ?? 'en';
    const url = input.url?.trim() || '';
    const link = url && locale === 'ar' ? (0, notification_texts_1.isolateLtr)(url) : url;
    const lines = [`*${input.title.trim()}*`, input.body?.trim() || '', link].filter(Boolean);
    return (0, notification_texts_1.finalizeText)(truncateText(lines.join('\n'), maxChars), locale);
}
function portalBaseForRole(role, urls) {
    switch (role) {
        case 'dealer_agent':
            return urls.dealer;
        case 'credit_officer':
            return urls.credit;
        case 'finance_officer':
        case 'partner_viewer':
            return urls.finance;
        case 'admin':
        case 'group_admin':
            return urls.admin;
        case 'super_admin':
            return urls.superAdmin;
        default:
            return urls.marketplace;
    }
}
function absoluteNotificationUrl(linkPath, role, urls) {
    const path = linkPath?.trim();
    if (!path)
        return null;
    if (/^https?:\/\//i.test(path))
        return path;
    const base = portalBaseForRole(role, urls).replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
function dispatchSummary(result) {
    const summary = {};
    for (const [channel, outcome] of Object.entries(result.channels)) {
        summary[channel] = outcome.reason ? `${outcome.outcome}:${outcome.reason}` : outcome.outcome;
    }
    return summary;
}
//# sourceMappingURL=notification-routing.js.map