/**
 * Backfill installment_plan from pricing_snapshot for applications missing a plan.
 * Run: npm -w @drivemarket/api run db:backfill-installment-plan
 */
import { PrismaClient } from '@prisma/client';
import { backfillInstallmentPlans } from '../src/applications/backfill-installment-plan';

const prisma = new PrismaClient();

async function main() {
  const { updated } = await backfillInstallmentPlans(prisma);
  console.log(`Backfilled installment_plan on ${updated} applications`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
