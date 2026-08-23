import { buildPlanFromPricingSnapshot } from '@drivemarket/shared/installment-plan';
import { Prisma, type PrismaClient } from '@prisma/client';

export async function backfillInstallmentPlans(prisma: PrismaClient) {
  const apps = await prisma.application.findMany({
    where: { installmentPlan: { equals: Prisma.DbNull } },
    select: { id: true, pricingSnapshot: true },
  });

  let updated = 0;
  for (const app of apps) {
    const snap = app.pricingSnapshot as Record<string, unknown>;
    const plan = buildPlanFromPricingSnapshot({ pricingSnapshot: snap });
    await prisma.application.update({
      where: { id: app.id },
      data: { installmentPlan: plan as object },
    });
    updated += 1;
  }

  return { updated };
}
