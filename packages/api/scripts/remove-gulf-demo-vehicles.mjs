/**
 * Remove the four Gulf Motors demo vehicles shown on marketplace.
 * node packages/api/scripts/remove-gulf-demo-vehicles.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = [
  'toyota-land-cruiser-vx-2024-pearl-white-automatic-suv-seed0001',
  'nissan-patrol-platinum-2023-black-automatic-suv-seed0002',
  'lexus-es-350-f-sport-2022-sonic-titanium-automatic-sedan-seed0003',
  'hyundai-tucson-limited-2024-amazon-grey-automatic-suv-seed0004',
];

async function main() {
  const products = await prisma.product.findMany({
    where: { slug: { in: SLUGS } },
    select: { id: true, slug: true, make: true, model: true, trim: true },
  });

  if (products.length === 0) {
    console.log('No matching vehicles found.');
    return;
  }

  console.log('Removing:');
  for (const p of products) console.log(`  - ${p.make} ${p.model} ${p.trim ?? ''} (${p.slug})`);

  const ids = products.map((p) => p.id);

  // Clear related rows that block product delete
  const apps = await prisma.application.findMany({
    where: { productId: { in: ids } },
    select: { id: true },
  });
  const appIds = apps.map((a) => a.id);

  if (appIds.length) {
    await prisma.paymentSchedule.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.applicationDocument.deleteMany({ where: { applicationId: { in: appIds } } });
    await prisma.dealerQuote.deleteMany({ where: { usedByApplicationId: { in: appIds } } });
    await prisma.application.deleteMany({ where: { id: { in: appIds } } });
    console.log(`Deleted ${appIds.length} related application(s)`);
  }

  await prisma.dealerQuote.deleteMany({ where: { productId: { in: ids } } });
  await prisma.productImage.deleteMany({ where: { productId: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });

  console.log(`✓ Removed ${ids.length} vehicle(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
