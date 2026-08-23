import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import type { Prisma, ScheduleStatus } from '@prisma/client';
import { aggregateDailyScheduleToMonthly } from '@drivemarket/shared/installment-plan-utils';
import { buildScheduleDrafts } from './payment-schedules';

export async function syncPaymentSchedulesFromInstallmentPlan(
  tx: Prisma.TransactionClient,
  applicationId: string,
  pricingSnapshot: Record<string, unknown>,
  installmentPlan: InstallmentPlan | null | undefined,
  opts?: { replaceExisting?: boolean },
) {
  const replaceExisting = opts?.replaceExisting ?? true;
  const drafts = buildScheduleDrafts(pricingSnapshot, new Date(), installmentPlan ?? undefined);

  if (replaceExisting) {
    await tx.paymentSchedule.deleteMany({ where: { applicationId } });
  }

  await tx.paymentSchedule.createMany({
    data: drafts.map((s) => ({
      applicationId,
      sequence: s.sequence,
      dueDate: s.dueDate,
      amount: s.amount,
      paidAmount: 0,
      remainingAmount: s.amount,
      status: 'pending' as ScheduleStatus,
    })),
  });
}

export function convertInstallmentPlanDailyToMonthly(
  plan: InstallmentPlan,
): InstallmentPlan {
  const monthlySchedule = aggregateDailyScheduleToMonthly(plan.schedule ?? []);
  return {
    ...plan,
    interval: 'Monthly',
    schedule: monthlySchedule,
    monthlyAmount: monthlySchedule[0]?.amount ?? plan.monthlyAmount,
  };
}
