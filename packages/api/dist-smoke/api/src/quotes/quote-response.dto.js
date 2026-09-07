"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDealerQuoteDto = toDealerQuoteDto;
exports.toDealerQuoteListItemDto = toDealerQuoteListItemDto;
exports.toQuoteRevokeDto = toQuoteRevokeDto;
exports.toPublicQuoteResolveDto = toPublicQuoteResolveDto;
const offer_response_dto_1 = require("../common/offer-response.dto");
function asNumber(value) {
    if (value == null)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function toDealerQuoteDto(quote) {
    return {
        id: quote.id,
        token: quote.token,
        url: quote.url,
        customer_email: quote.customerEmail,
        negotiated_price: asNumber(quote.negotiatedPrice),
        list_price_snapshot: asNumber(quote.listPriceSnapshot),
        expires_at: quote.expiresAt,
        status: quote.status,
        product: {
            make: quote.product.make,
            model: quote.product.model,
            model_year: quote.product.modelYear,
            slug: quote.product.slug,
        },
    };
}
function toDealerQuoteListItemDto(quote) {
    return {
        id: quote.id,
        token: quote.token,
        url: quote.url,
        customer_email: quote.customerEmail,
        negotiated_price: asNumber(quote.negotiatedPrice),
        list_price_snapshot: asNumber(quote.listPriceSnapshot),
        expires_at: quote.expiresAt,
        used_at: quote.usedAt,
        revoked_at: quote.revokedAt,
        created_at: quote.createdAt,
        status: quote.status,
        product: {
            make: quote.product.make,
            model: quote.product.model,
            model_year: quote.product.modelYear,
            slug: quote.product.slug,
        },
        created_by: {
            name: quote.createdBy.name,
            email: quote.createdBy.email,
        },
    };
}
function toQuoteRevokeDto(result) {
    return { id: result.id, status: result.status };
}
function toPublicQuoteResolveDto(input) {
    const base = {
        gate: input.gate,
        token: input.token,
        expires_at: input.expiresAt,
        customer_email_masked: input.customerEmailMasked,
        product: {
            id: input.product.id,
            slug: input.product.slug,
            make: input.product.make,
            model: input.product.model,
            trim: input.product.trim,
            model_year: input.product.modelYear,
            condition: input.product.condition,
            mileage: input.product.mileage,
            color: input.product.color,
            public_list_price: input.product.publicListPrice,
            finance_eligible: input.product.financeEligible,
            listing_status: input.product.listingStatus,
            image_path: input.product.imagePath,
        },
        company: {
            id: input.company.id,
            name: input.company.name,
            code: input.company.code,
            logo_url: input.company.logoUrl,
        },
    };
    if (input.gate !== 'active') {
        return base;
    }
    return {
        ...base,
        negotiated_price: input.negotiatedPrice ?? null,
        list_price_snapshot: input.listPriceSnapshot ?? null,
        offer: input.offer ? (0, offer_response_dto_1.toPublicOfferDto)(input.offer) : null,
    };
}
//# sourceMappingURL=quote-response.dto.js.map