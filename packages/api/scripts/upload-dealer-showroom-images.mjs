/**
 * Replace placeholder listing images for dealer showroom inventory.
 * Uploads catalog art to production listing storage and updates product_images.
 *
 * Local (needs production DATABASE_URL + S3 from Railway):
 *   railway run --service api node scripts/upload-dealer-showroom-images.mjs
 *
 * Or with env already set:
 *   node packages/api/scripts/upload-dealer-showroom-images.mjs
 */
import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreateBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEALER_EMAIL = process.env.DEALER_EMAIL ?? 'dealer@drivemarket.local';

/** @type {Array<{ make: string; model: string; files: string[] }>} */
const VEHICLE_IMAGES = [
  {
    make: 'Chery',
    model: 'Tiggo 7 Pro',
    files: [
      'chery-tiggo-7-pro-black-2026-qs387750.webp',
      'chery-tiggo-7-pro-max-gray-2026-qs365017.webp',
    ],
  },
  {
    make: 'Chery',
    model: 'Tiggo 8 Pro',
    files: [
      'chery-tiggo-8-pro-white-2026-qs462557.webp',
      'chery-tiggo-8-pro-max-silver-2026-qs379168.webp',
    ],
  },
  {
    make: 'Chery',
    model: 'Omoda 5',
    files: ['chery-tiggo-7-silver-2026-qs509580.webp', 'chery-tiggo-7-gray-2026-qs509583.webp'],
  },
  {
    make: 'Chery',
    model: 'Arrizo 8',
    files: ['chery-arrizo-8-standard-gray-2026-qs387742.webp'],
  },
  {
    make: 'Toyota',
    model: 'Camry',
    files: ['audi-a5-sedan.webp', 'audi-a6.webp'],
  },
  {
    make: 'Nissan',
    model: 'Patrol',
    files: ['audi-q7-250-kw.webp', 'vehicle-1-vw-teramont-grey.png'],
  },
  {
    make: 'Hyundai',
    model: 'Tucson',
    files: ['audi-q5-suv.webp', 'vehicle-72-hyundai-accent-silver.png'],
  },
  {
    make: 'Kia',
    model: 'Sportage',
    files: ['audi-q5-sportback.webp', 'audi-q3-sportback.webp'],
  },
  {
    make: 'MG',
    model: 'HS',
    files: ['vehicle-70-mg-zs-white.png', 'vehicle-71-mg-zs-red.png'],
  },
  {
    make: 'Chery',
    model: 'Tiggo 4 Pro',
    files: ['vehicle-67-chery-tiggo4-blue.png', 'vehicle-65-chery-tiggo4-white.png'],
  },
];

function mimeForExt(ext) {
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

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveImageDirs() {
  const candidates = [
    path.resolve(__dirname, '../../marketplace/public/vehicles'),
    path.resolve(__dirname, '../assets/qauto-catalog'),
  ];
  /** @type {string[]} */
  const found = [];
  for (const dir of candidates) {
    if (await fileExists(dir)) found.push(dir);
  }
  if (found.length === 0) {
    throw new Error('No vehicle image directories found (marketplace/public/vehicles or assets/qauto-catalog).');
  }
  return found;
}

async function resolveSourceFile(dirs, fileName) {
  for (const dir of dirs) {
    const filePath = path.join(dir, fileName);
    if (await fileExists(filePath)) return filePath;
  }
  throw new Error(`Image not found: ${fileName}`);
}

async function createStorageWriter() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const localRoot = path.join(process.cwd(), '.uploads');
  const bucket = process.env.S3_BUCKET_LISTINGS ?? 'listing-images';

  if (!endpoint) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(localRoot, { recursive: true });
    return {
      put: async (key, body, contentType) => {
        const full = path.join(localRoot, bucket, key);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, body);
        return `/uploads/${bucket}/${key}`;
      },
    };
  }

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch {
    /* exists */
  }

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
  return {
    put: async (key, body, contentType) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
      return `/api/v1/media/listings/${key}`;
    },
  };
}

async function main() {
  const prisma = new PrismaClient();
  const imageDirs = await resolveImageDirs();
  const storage = await createStorageWriter();
  console.log('Image dirs:', imageDirs.join(', '));
  console.log('Storage:', process.env.S3_ENDPOINT ? 'S3/R2' : 'local .uploads\n');

  const dealer = await prisma.user.findUnique({
    where: { email: DEALER_EMAIL },
    select: { id: true, companyId: true },
  });
  if (!dealer?.companyId) {
    throw new Error(`Dealer ${DEALER_EMAIL} not found or has no company_id.`);
  }

  const products = await prisma.product.findMany({
    where: { companyId: dealer.companyId },
    select: { id: true, make: true, model: true, companyId: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${products.length} products for dealer company ${dealer.companyId}\n`);

  let updated = 0;
  let skipped = 0;

  for (const mapping of VEHICLE_IMAGES) {
    const product = products.find((p) => p.make === mapping.make && p.model === mapping.model);
    if (!product) {
      console.warn(`Skip — no product: ${mapping.make} ${mapping.model}`);
      skipped += 1;
      continue;
    }

    const removed = await prisma.productImage.deleteMany({ where: { productId: product.id } });
    console.log(`${mapping.make} ${mapping.model} (${product.id}) — removed ${removed.count} image(s)`);

    for (let sortOrder = 0; sortOrder < mapping.files.length; sortOrder += 1) {
      const fileName = mapping.files[sortOrder];
      const filePath = await resolveSourceFile(imageDirs, fileName);
      const ext = path.extname(filePath).toLowerCase() || '.webp';
      const bytes = await readFile(filePath);
      const key = `${product.companyId}/${product.id}/${randomUUID()}${ext}`;
      const storagePath = await storage.put(key, bytes, mimeForExt(ext));
      await prisma.productImage.create({
        data: {
          productId: product.id,
          storagePath,
          sortOrder,
          altText: `${product.make} ${product.model}`,
        },
      });
      console.log(`  + ${fileName} → ${storagePath}`);
    }
    updated += 1;
    console.log('');
  }

  console.log('Done.');
  console.log('Updated:', updated, 'Skipped:', skipped);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
