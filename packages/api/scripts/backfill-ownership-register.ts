/**
 * Backfill ownership registers from pricing snapshots for applications that
 * already have a recorded down payment or are active/completed.
 *
 * Run: npm -w @drivemarket/api run db:backfill-ownership-register
 */
import { PrismaClient } from '@prisma/client';
import { openRegister } from '../src/musharakah/register';

const prisma = new PrismaClient();

async function main() {
  const apps = await prisma.application.findMany({
    where: {
      ownershipRegister: null,
      status: {
        in: [
          'down_payment_submitted',
          'pending_finance_activation',
          'lpo_issued',
          'acquisition_pending',
          'active',
          'hardship',
          'completed',
        ],
      },
    },
    select: { id: true, pricingSnapshot: true },
  });

  let opened = 0;
  for (const app of apps) {
    const pricing = (app.pricingSnapshot ?? {}) as Record<string, unknown>;
    await openRegister(prisma, { applicationId: app.id, pricing });
    opened += 1;
  }
  console.log(`Opened ownership registers for ${opened} applications`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
