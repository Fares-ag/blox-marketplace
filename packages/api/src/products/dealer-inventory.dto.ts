import type { Product, ProductImage } from '@prisma/client';

type ProductWithImages = Product & { images?: ProductImage[] };

export function toDealerInventoryDto(product: ProductWithImages) {
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

export function toDealerProductImageDto(image: ProductImage) {
  return {
    id: image.id,
    storage_path: image.storagePath,
    sort_order: image.sortOrder,
    alt_text: image.altText,
  };
}

export function toDealerInventoryListResponse(
  items: ProductWithImages[],
  total: number,
  limit: number,
  offset: number,
) {
  return {
    total,
    limit,
    offset,
    items: items.map((item) => toDealerInventoryDto(item)),
  };
}
