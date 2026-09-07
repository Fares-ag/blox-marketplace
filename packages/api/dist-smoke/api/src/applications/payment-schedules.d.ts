import type { InstallmentPlan } from "@drivemarket/shared/installment-plan";
export type ScheduleDraft = {
    sequence: number;
    dueDate: Date;
    amount: number;
};
export declare function buildScheduleDraftsFromInstallmentPlan(plan: InstallmentPlan): ScheduleDraft[];
export declare function buildScheduleDrafts(pricingSnapshot: Record<string, unknown>, start?: Date, installmentPlan?: InstallmentPlan | null): ScheduleDraft[];
