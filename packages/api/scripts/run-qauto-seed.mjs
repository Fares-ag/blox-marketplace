/**
 * Idempotent QAuto bootstrap + inventory seed.
 * Production: railway ssh -s api node scripts/run-qauto-seed.mjs
 * Local: node packages/api/scripts/run-qauto-seed.mjs
 */
import { PrismaClient } from '@prisma/client';
import { bootstrapQauto } from '../prisma/bootstrap-qauto.ts';
import { seedFinancePartners } from '../prisma/seed-finance-partners.ts';
import { seedQautoInventory } from '../prisma/seed-qauto-inventory.ts';

const prisma = new PrismaClient();

async function main() {
  await seedFinancePartners(prisma);
  const boot = await bootstrapQauto(prisma);
  console.log('bootstrap:', JSON.stringify(boot));
  const seed = await seedQautoInventory(prisma);
  console.log('inventory:', JSON.stringify(seed));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
