import type { PrismaClient } from '@prisma/client';
import { listingImageMediaPath } from '../../shared/src/lib/listing-image-url';

/** Rewrite private R2/S3 endpoint URLs to API media proxy paths. */
export async function backfillListingImageUrls(prisma: PrismaClient) {
  const images = await prisma.productImage.findMany({
    select: { id: true, storagePath: true },
  });

  let updated = 0;
  for (const image of images) {
    const proxyPath = listingImageMediaPath(image.storagePath);
    if (!proxyPath || proxyPath === image.storagePath) continue;
    await prisma.productImage.update({
      where: { id: image.id },
      data: { storagePath: proxyPath },
    });
    updated += 1;
  }

  return { total: images.length, updated };
}
