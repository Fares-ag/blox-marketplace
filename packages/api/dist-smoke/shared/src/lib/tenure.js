"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENURE_PRESET_MONTHS = exports.MAX_TENURE_MONTHS = exports.MIN_TENURE_MONTHS = void 0;
exports.isTenureInRange = isTenureInRange;
exports.clampTenureMonths = clampTenureMonths;
exports.parseTenureToMonths = parseTenureToMonths;
exports.formatMonthsToTenure = formatMonthsToTenure;
exports.MIN_TENURE_MONTHS = 3;
exports.MAX_TENURE_MONTHS = 60;
exports.TENURE_PRESET_MONTHS = [12, 24, 36, 48, 60];
function isTenureInRange(months) {
    return Number.isFinite(months) && months >= exports.MIN_TENURE_MONTHS && months <= exports.MAX_TENURE_MONTHS;
}
function clampTenureMonths(months) {
    if (!Number.isFinite(months))
        return exports.MIN_TENURE_MONTHS;
    return Math.min(Math.max(Math.round(months), exports.MIN_TENURE_MONTHS), exports.MAX_TENURE_MONTHS);
}
function parseTenureToMonths(tenureStr) {
    if (!tenureStr)
        return 12;
    const yearMatch = tenureStr.match(/(\d+)\s*year/i);
    const monthMatch = tenureStr.match(/(\d+)\s*month/i);
    const years = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const months = monthMatch ? parseInt(monthMatch[1], 10) : 0;
    if (yearMatch || monthMatch) {
        return clampTenureMonths(years * 12 + months);
    }
    const n = parseInt(tenureStr.replace(/\D/g, ''), 10);
    return clampTenureMonths(Number.isFinite(n) && n > 0 ? n : exports.MIN_TENURE_MONTHS);
}
function formatMonthsToTenure(months) {
    if (months <= 0)
        return '12 Months';
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0 && remainingMonths === 0) {
        return `${years} Year${years > 1 ? 's' : ''}`;
    }
    return `${months} Months`;
}
//# sourceMappingURL=tenure.js.map