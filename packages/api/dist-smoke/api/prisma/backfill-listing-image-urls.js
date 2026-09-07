"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillListingImageUrls = backfillListingImageUrls;
const listing_image_url_1 = require("../../shared/src/lib/listing-image-url");
async function backfillListingImageUrls(prisma) {
    const images = await prisma.productImage.findMany({
        select: { id: true, storagePath: true },
    });
    let updated = 0;
    for (const image of images) {
        const proxyPath = (0, listing_image_url_1.listingImageMediaPath)(image.storagePath);
        if (!proxyPath || proxyPath === image.storagePath)
            continue;
        await prisma.productImage.update({
            where: { id: image.id },
            data: { storagePath: proxyPath },
        });
        updated += 1;
    }
    return { total: images.length, updated };
}
//# sourceMappingURL=backfill-listing-image-urls.js.map