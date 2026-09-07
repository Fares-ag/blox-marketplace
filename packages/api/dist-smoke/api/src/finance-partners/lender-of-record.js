"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_LENDER_NAME = void 0;
exports.resolveLenderOfRecord = resolveLenderOfRecord;
exports.FALLBACK_LENDER_NAME = 'Blox Finance';
function clean(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
function resolveLenderOfRecord(input) {
    return (clean(input.taggedPartnerName) ??
        clean(input.offerPartnerName) ??
        clean(input.defaultLenderName) ??
        clean(input.configuredName) ??
        exports.FALLBACK_LENDER_NAME);
}
//# sourceMappingURL=lender-of-record.js.map