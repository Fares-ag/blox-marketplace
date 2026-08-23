import { PrismaClient } from '@prisma/client';
import { seedFinancePartners } from './seed-finance-partners';
import { seedCheryInventory } from './seed-chery';

const prisma = new PrismaClient();

async function main() {
  const finance = await seedFinancePartners(prisma);
  console.log('Finance partners seeded:', finance.partners.join(', '));

  const chery = await seedCheryInventory(prisma);
  console.log(
    `Published ${chery.listingsPublished} Chery Elite Motors listings (${chery.companyName}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
