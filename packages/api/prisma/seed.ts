import { PrismaClient } from '@prisma/client';
import { seedFinancePartners } from './seed-finance-partners';
import { seedCheryInventory } from './seed-chery';
import { seedBranches } from './seed-branches';

const prisma = new PrismaClient();

async function main() {
  const finance = await seedFinancePartners(prisma);
  console.log(
    `Finance partners seeded: ${finance.partners.join(', ')} (default lender: ${finance.defaultLender ?? 'none'}).`,
  );

  const chery = await seedCheryInventory(prisma);
  console.log(
    `Published ${chery.listingsPublished} Chery Elite Motors listings (${chery.companyName}).`,
  );

  // One MAIN branch per seeded dealership; dealer agents without a home branch get it.
  const branches = await seedBranches(prisma);
  console.log(
    `Branches seeded for ${branches.branches} dealership(s); ${branches.agentsAssigned} dealer agent(s) assigned a home branch.`,
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
