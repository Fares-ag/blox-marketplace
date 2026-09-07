"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicOfferDto = toPublicOfferDto;
exports.toPublicOfferListResponse = toPublicOfferListResponse;
function asNumber(value) {
    if (value == null)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function toPublicOfferDto(offer) {
    return {
        id: offer.id,
        name: offer.name,
        annual_rent_rate: asNumber(offer.annualRentRate),
        tenure_options: offer.tenureOptions,
        min_down_payment_pct: asNumber(offer.minDownPaymentPct),
        finance_partner_id: offer.financePartnerId ?? null,
        finance_partner_name: offer.financePartner?.name ?? null,
        crm_adapter: offer.financePartner?.crmAdapter ?? null,
        ...(offer.isDefault !== undefined ? { is_default: offer.isDefault } : {}),
    };
}
function toPublicOfferListResponse(items, total) {
    return { total, items: items.map((item) => toPublicOfferDto(item)) };
}
//# sourceMappingURL=offer-response.dto.js.map