import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import { installmentAmountsFromPricingSnapshot } from '@drivemarket/shared/pricing';

export type ScheduleDraft = {
  sequence: number;
  dueDate: Date;
  amount: number;
};

function parseDueDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('invalid_schedule_due_date');
  }
  return d;
}

function installmentRowsFromPlan(plan: InstallmentPlan) {
  return (plan.schedule ?? []).filter(
    (row) =>
      row.paymentType !== 'down_payment' &&
      !row.isBalloon &&
      (Number(row.amount) || 0) > 0,
  );
}

/** Build DB schedule drafts from persisted installment_plan (vercel sync path). */
export function buildScheduleDraftsFromInstallmentPlan(
  plan: InstallmentPlan,
): ScheduleDraft[] {
  const rows = installmentRowsFromPlan(plan);
  if (rows.length === 0) {
    throw new Error('empty_installment_plan_schedule');
  }
  return rows.map((row, index) => ({
    sequence: index + 1,
    dueDate: parseDueDate(row.dueDate),
    amount: Number(row.amount),
  }));
}

export function buildScheduleDrafts(
  pricingSnapshot: Record<string, unknown>,
  start = new Date(),
  installmentPlan?: InstallmentPlan | null,
): ScheduleDraft[] {
  if (installmentPlan?.schedule?.length) {
    try {
      return buildScheduleDraftsFromInstallmentPlan(installmentPlan);
    } catch {
      /* fall through to pricing snapshot */
    }
  }

  const monthly = Number(pricingSnapshot.monthly);
  const tenorHint = Number(pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? 0);
  if (!(monthly > 0) || !(tenorHint > 0)) {
    throw new Error('invalid_pricing_snapshot');
  }
  const amounts = installmentAmountsFromPricingSnapshot(pricingSnapshot);
  const tenor = amounts.length;
  if (tenor <= 0) {
    throw new Error('invalid_pricing_snapshot');
  }

  const drafts: ScheduleDraft[] = [];
  for (let sequence = 1; sequence <= tenor; sequence += 1) {
    const dueDate = new Date(start);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + sequence);
    drafts.push({ sequence, dueDate, amount: amounts[sequence - 1]! });
  }
  return drafts;
}
