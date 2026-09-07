import type { InstallmentPlan } from "@drivemarket/shared/installment-plan";
import type { Prisma } from '@prisma/client';
export declare function syncPaymentSchedulesFromInstallmentPlan(tx: Prisma.TransactionClient, applicationId: string, pricingSnapshot: Record<string, unknown>, installmentPlan: InstallmentPlan | null | undefined, opts?: {
    replaceExisting?: boolean;
}): Promise<void>;
export declare function convertInstallmentPlanDailyToMonthly(plan: InstallmentPlan): InstallmentPlan;
