"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDealerInventoryDto = toDealerInventoryDto;
exports.toDealerProductImageDto = toDealerProductImageDto;
exports.toDealerInventoryListResponse = toDealerInventoryListResponse;
const vehicle_identity_1 = require("./vehicle-identity");
function toDealerInventoryDto(product) {
    return {
        id: product.id,
        company_id: product.companyId,
        slug: product.slug,
        make: product.make,
        model: product.model,
        trim: product.trim,
        model_year: product.modelYear,
        condition: product.condition,
        engine: product.engine,
        transmission: product.transmission,
        cylinders: product.cylinders,
        drivetrain: product.drivetrain,
        body_type: product.bodyType,
        warranty_months: product.warrantyMonths,
        warranty_notes: product.warrantyNotes,
        color: product.color,
        mileage: product.mileage,
        vin: product.vin,
        chassis_number: product.chassisNumber,
        engine_number: product.engineNumber,
        identity_complete: (0, vehicle_identity_1.vehicleIdentityComplete)(product),
        description: product.description,
        price: Number(product.price),
        finance_eligible: product.financeEligible,
        default_offer_id: product.defaultOfferId,
        listing_status: product.listingStatus,
        published_at: product.publishedAt,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        primary_image: product.images?.[0]?.storagePath ?? null,
        images: (product.images ?? []).map(toDealerProductImageDto),
    };
}
function toDealerProductImageDto(image) {
    return {
        id: image.id,
        storage_path: image.storagePath,
        sort_order: image.sortOrder,
        alt_text: image.altText,
    };
}
function toDealerInventoryListResponse(items, total, limit, offset) {
    return {
        total,
        limit,
        offset,
        items: items.map((item) => toDealerInventoryDto(item)),
    };
}
//# sourceMappingURL=dealer-inventory.dto.js.map