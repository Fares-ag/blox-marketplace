/**
 * One-time rollout helper after flipping musharakah env flags:
 * - Enables unit-offer loop on every company (global flag alone is not enough;
 *   Company.unitOffersEnabled defaults to false).
 *
 * Run: npm -w @drivemarket/api run db:enable-musharakah-rollout
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.company.updateMany({
    data: { unitOffersEnabled: true },
  });
  console.log(`Enabled unit offers on ${result.count} companies`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
