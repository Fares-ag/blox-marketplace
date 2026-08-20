import { installmentAmountsFromPricingSnapshot } from '@drivemarket/shared/pricing';

export type ScheduleDraft = {
  sequence: number;
  dueDate: Date;
  amount: number;
};

export function buildScheduleDrafts(
  pricingSnapshot: Record<string, unknown>,
  start = new Date(),
): ScheduleDraft[] {
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
