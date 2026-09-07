"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTenureInRange = exports.clampTenureMonths = exports.MIN_TENURE_MONTHS = exports.MAX_TENURE_MONTHS = exports.clampDownPaymentPct = exports.buildPricingSnapshot = void 0;
exports.normalizeEmail = normalizeEmail;
exports.parseTenureOptions = parseTenureOptions;
exports.assertTenureAllowed = assertTenureAllowed;
exports.resolveQuoteGate = resolveQuoteGate;
const tenure_1 = require("@drivemarket/shared/tenure");
Object.defineProperty(exports, "MAX_TENURE_MONTHS", { enumerable: true, get: function () { return tenure_1.MAX_TENURE_MONTHS; } });
Object.defineProperty(exports, "MIN_TENURE_MONTHS", { enumerable: true, get: function () { return tenure_1.MIN_TENURE_MONTHS; } });
Object.defineProperty(exports, "clampTenureMonths", { enumerable: true, get: function () { return tenure_1.clampTenureMonths; } });
Object.defineProperty(exports, "isTenureInRange", { enumerable: true, get: function () { return tenure_1.isTenureInRange; } });
var pricing_1 = require("@drivemarket/shared/pricing");
Object.defineProperty(exports, "buildPricingSnapshot", { enumerable: true, get: function () { return pricing_1.buildPricingSnapshot; } });
Object.defineProperty(exports, "clampDownPaymentPct", { enumerable: true, get: function () { return pricing_1.clampDownPaymentPct; } });
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function parseTenureOptions(raw) {
    if (!Array.isArray(raw))
        return [12, 24, 36, 48, 60];
    const parsed = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    return parsed.length > 0 ? parsed : [12, 24, 36, 48, 60];
}
function assertTenureAllowed(tenureMonths, _tenureOptions) {
    void _tenureOptions;
    if (!(0, tenure_1.isTenureInRange)(tenureMonths)) {
        throw new Error('invalid_tenure');
    }
}
function resolveQuoteGate(quote, viewer) {
    if (quote.revokedAt)
        return 'revoked';
    if (quote.usedAt)
        return 'used';
    if (quote.expiredAt || quote.expiresAt.getTime() <= Date.now())
        return 'expired';
    if (!viewer || viewer.role !== 'customer')
        return 'requiresAuth';
    if (normalizeEmail(viewer.email) !== normalizeEmail(quote.customerEmail))
        return 'wrongEmail';
    return 'active';
}
//# sourceMappingURL=quote-pricing.js.map