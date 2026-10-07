import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CreateBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';
import { loadQautoListings, type QautoListing } from './seed-qauto-inventory';

const LOCAL_BUCKET = 'listing-images';

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.webp':
      return 'image/webp';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

export async function resolveQautoImageSourceDir(): Promise<string> {
  const fromEnv = process.env.QAUTO_IMAGE_SOURCE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const candidates = [
    path.resolve(process.cwd(), 'assets/qauto-catalog'),
    path.resolve(process.cwd(), '../../../blox-app/assets/vehicles/catalog'),
    path.resolve(process.cwd(), '../../blox-app/assets/vehicles/catalog'),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return candidates[0];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every QAuto listing carries a dedicated catalog render in `listing.image`
 * (e.g. "/vehicles/vw-tiguan.webp"). Audi SKUs have one render each; VW and
 * Skoda SKUs share one render per model family (all Tiguan colours/trims use
 * vw-tiguan.webp, Octavia RS has its own sport-fascia shot, etc.).
 */
function catalogSourceName(listing: QautoListing): string | null {
  if (!listing.image) return null;
  const base = path.basename(listing.image);
  return base || null;
}

export async function resolveQautoSourceFile(
  listing: QautoListing,
  sourceDir: string,
): Promise<{ filePath: string; kind: 'catalog' } | null> {
  const fileName = catalogSourceName(listing);
  if (!fileName) return null;

  const filePath = path.join(sourceDir, fileName);
  if (!(await fileExists(filePath))) return null;

  return { filePath, kind: 'catalog' };
}

function storageKey(productId: string, ext: string): string {
  return `qauto/${productId}/cover${ext}`;
}

function publicPath(key: string, useLocal: boolean, publicBase?: string): string {
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
  if (useLocal) return `/uploads/${LOCAL_BUCKET}/${key}`;
  // Private R2/S3 endpoints are not browser-loadable — serve through the API media proxy.
  return `/api/v1/media/listings/${key}`;
}

async function createStorageWriter() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const localRoot = path.join(process.cwd(), '.uploads');

  if (!endpoint) {
    await mkdir(localRoot, { recursive: true });
    return {
      useLocal: true,
      put: async (key: string, body: Buffer, _contentType: string) => {
        const full = path.join(localRoot, LOCAL_BUCKET, key);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, body);
        return publicPath(key, true);
      },
    };
  }

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });

  const bucket = process.env.S3_BUCKET_LISTINGS ?? LOCAL_BUCKET;
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch {
    /* exists */
  }

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
  return {
    useLocal: false,
    put: async (key: string, body: Buffer, contentType: string) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return publicPath(key, false, publicBase);
    },
  };
}

async function upsertCoverPath(
  prisma: PrismaClient,
  productId: string,
  listing: QautoListing,
  storagePath: string,
) {
  const alt = `${listing.make} ${listing.model}`.trim();
  const existing = await prisma.productImage.findFirst({
    where: { productId, sortOrder: 0 },
  });
  if (existing) {
    await prisma.productImage.update({
      where: { id: existing.id },
      data: { storagePath, altText: alt },
    });
    return;
  }
  await prisma.productImage.create({
    data: {
      productId,
      storagePath,
      sortOrder: 0,
      altText: alt,
    },
  });
}

/** Upload catalog images into listing storage and point product_images at served URLs. */
export async function uploadQautoListingImages(
  prisma: PrismaClient,
  opts?: { sourceDir?: string },
) {
  const sourceDir = opts?.sourceDir ?? (await resolveQautoImageSourceDir());
  if (!(await fileExists(sourceDir))) {
    throw new Error(
      `QAuto image source directory not found: ${sourceDir}. Set QAUTO_IMAGE_SOURCE_DIR or copy assets to packages/api/assets/qauto-catalog`,
    );
  }

  const storage = await createStorageWriter();
  const listings = loadQautoListings();

  let uploadedCatalog = 0;
  let missingProduct = 0;
  let missingSource = 0;

  for (const listing of listings) {
    const product = await prisma.product.findUnique({ where: { id: listing.id } });
    if (!product) {
      missingProduct += 1;
      continue;
    }

    const source = await resolveQautoSourceFile(listing, sourceDir);
    if (!source) {
      missingSource += 1;
      continue;
    }

    const ext = path.extname(source.filePath).toLowerCase() || '.webp';
    const bytes = await readFile(source.filePath);
    const key = storageKey(listing.id, ext);
    const url = await storage.put(key, bytes, mimeForExt(ext));
    await upsertCoverPath(prisma, product.id, listing, url);
    uploadedCatalog += 1;
  }

  return {
    sourceDir,
    uploadedCatalog,
    uploadedTotal: uploadedCatalog,
    missingProduct,
    missingSource,
  };
}
