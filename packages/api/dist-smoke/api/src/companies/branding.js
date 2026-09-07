"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANDING_KEYS = void 0;
exports.isHexColour = isHexColour;
exports.normalizeHexColour = normalizeHexColour;
exports.toBrandingDto = toBrandingDto;
exports.mergeBranding = mergeBranding;
const common_1 = require("@nestjs/common");
exports.BRANDING_KEYS = [
    'primary',
    'accent',
    'logo_url',
    'display_name',
    'tagline',
];
const LEGACY_KEYS = {
    logoUrl: 'logo_url',
    displayName: 'display_name',
    primaryColor: 'primary',
    accentColor: 'accent',
};
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LOGO_URL = /^(?:https?:\/\/|\/)[^\s<>"']+$/i;
function isHexColour(value) {
    return HEX_COLOUR.test(value.trim());
}
function normalizeHexColour(value) {
    const trimmed = value.trim();
    if (!HEX_COLOUR.test(trimmed))
        throw new common_1.BadRequestException('invalid_hex_colour');
    const hex = trimmed.slice(1).toLowerCase();
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return `#${full}`;
}
function cleanText(value) {
    if (value == null)
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function readStored(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const target = exports.BRANDING_KEYS.includes(key)
            ? key
            : LEGACY_KEYS[key];
        if (!target || typeof value !== 'string')
            continue;
        out[target] = cleanText(value);
    }
    return out;
}
function hasAnyValue(branding) {
    return exports.BRANDING_KEYS.some((key) => branding[key] != null);
}
function toBrandingDto(raw, fallbackLogoUrl) {
    const stored = readStored(raw);
    const dto = {
        primary: stored.primary ?? null,
        accent: stored.accent ?? null,
        logo_url: stored.logo_url ?? cleanText(fallbackLogoUrl),
        display_name: stored.display_name ?? null,
        tagline: stored.tagline ?? null,
    };
    return hasAnyValue(dto) ? dto : null;
}
function mergeBranding(raw, patch) {
    const stored = readStored(raw);
    const next = {
        primary: stored.primary ?? null,
        accent: stored.accent ?? null,
        logo_url: stored.logo_url ?? null,
        display_name: stored.display_name ?? null,
        tagline: stored.tagline ?? null,
    };
    for (const key of exports.BRANDING_KEYS) {
        if (patch[key] === undefined)
            continue;
        next[key] = cleanText(patch[key]);
    }
    if (patch.primary !== undefined && next.primary)
        next.primary = normalizeHexColour(next.primary);
    if (patch.accent !== undefined && next.accent)
        next.accent = normalizeHexColour(next.accent);
    if (patch.logo_url !== undefined && next.logo_url && !LOGO_URL.test(next.logo_url)) {
        throw new common_1.BadRequestException('invalid_logo_url');
    }
    return hasAnyValue(next) ? next : null;
}
//# sourceMappingURL=branding.js.map