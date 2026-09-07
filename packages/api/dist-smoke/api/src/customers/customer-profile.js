"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIsoDate = parseIsoDate;
exports.formatIsoDate = formatIsoDate;
exports.addressFromJson = addressFromJson;
exports.mergeAddressJson = mergeAddressJson;
exports.composeName = composeName;
exports.toCustomerProfileDto = toCustomerProfileDto;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const notification_preferences_1 = require("./notification-preferences");
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseIsoDate(value) {
    const match = ISO_DATE.exec(String(value ?? '').trim());
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
}
function formatIsoDate(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function addressFromJson(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const a = raw;
    const dto = {
        line1: cleanString(a.line1),
        area: cleanString(a.area),
        city: cleanString(a.city),
        zone: cleanString(a.zone),
        po_box: cleanString(a.poBox ?? a.po_box),
    };
    return Object.values(dto).some((v) => v !== null) ? dto : null;
}
function mergeAddressJson(current, patch) {
    const existing = addressFromJson(current) ?? { line1: null, area: null, city: null, zone: null, po_box: null };
    const pick = (key, stored) => key in patch ? cleanString(patch[key]) : (stored ?? null);
    return {
        line1: pick('line1', existing.line1),
        area: pick('area', existing.area),
        city: pick('city', existing.city),
        zone: pick('zone', existing.zone),
        poBox: pick('po_box', existing.po_box),
    };
}
function composeName(first, last) {
    const f = first?.trim();
    const l = last?.trim();
    return f && l ? `${f} ${l}` : null;
}
function toCustomerProfileDto(user, qid) {
    const parsed = qid ? (0, domain_rules_1.parseQid)(qid) : null;
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
        gender: user.gender ?? null,
        date_of_birth: formatIsoDate(user.dateOfBirth),
        nationality: user.nationality ?? null,
        residency: parsed?.valid ? parsed.residency : null,
        phone: user.phone ?? null,
        qid_masked: qid ? (0, domain_rules_1.maskQid)(qid) || null : null,
        preferred_language: user.preferredLanguage === 'ar' ? 'ar' : 'en',
        notification_preferences: (0, notification_preferences_1.resolveNotificationPreferences)(user.notificationPreferences),
        address: addressFromJson(user.address),
    };
}
//# sourceMappingURL=customer-profile.js.map