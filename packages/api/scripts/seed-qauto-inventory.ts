import { PrismaClient } from '@prisma/client';
import { seedFinancePartners } from '../prisma/seed-finance-partners';
import { seedQautoInventory } from '../prisma/seed-qauto-inventory';

const prisma = new PrismaClient();

async function main() {
  await seedFinancePartners(prisma);
  const result = await seedQautoInventory(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
