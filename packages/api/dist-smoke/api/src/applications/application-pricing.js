"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenureMonths = resolveTenureMonths;
exports.buildApplicationPricingSnapshot = buildApplicationPricingSnapshot;
exports.assertOfferMatchesProduct = assertOfferMatchesProduct;
const quote_pricing_1 = require("../quotes/quote-pricing");
function resolveTenureMonths(pricingSnapshot, fallback = 36) {
    const raw = pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? fallback;
    return Number(raw);
}
function buildApplicationPricingSnapshot(opts) {
    const tenureMonths = resolveTenureMonths(opts.pricingSnapshot);
    (0, quote_pricing_1.assertTenureAllowed)(tenureMonths, opts.offer.tenureOptions);
    const downPct = (0, quote_pricing_1.clampDownPaymentPct)(Number(opts.pricingSnapshot.down_payment_pct ?? opts.offer.minDownPaymentPct), Number(opts.offer.minDownPaymentPct));
    return (0, quote_pricing_1.buildPricingSnapshot)({
        listPrice: opts.listPrice,
        annualRatePercent: Number(opts.offer.annualRentRate),
        minDownPaymentPct: Number(opts.offer.minDownPaymentPct),
        tenureMonths,
        downPaymentPct: downPct,
    });
}
function assertOfferMatchesProduct(requestedOfferId, resolvedOfferId) {
    if (requestedOfferId && requestedOfferId !== resolvedOfferId) {
        throw new Error('offer_mismatch');
    }
}
//# sourceMappingURL=application-pricing.js.map