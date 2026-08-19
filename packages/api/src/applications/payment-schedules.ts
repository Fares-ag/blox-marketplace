export type ScheduleDraft = {
  sequence: number;
  dueDate: Date;
  amount: number;
};

export function buildScheduleDrafts(pricingSnapshot: Record<string, unknown>, start = new Date()): ScheduleDraft[] {
  const monthly = Number(pricingSnapshot.monthly);
  const tenor = Number(pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? 0);
  if (!Number.isFinite(monthly) || monthly <= 0 || !Number.isFinite(tenor) || tenor <= 0) {
    throw new Error('invalid_pricing_snapshot');
  }

  const drafts: ScheduleDraft[] = [];
  for (let sequence = 1; sequence <= tenor; sequence += 1) {
    const dueDate = new Date(start);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + sequence);
    drafts.push({ sequence, dueDate, amount: monthly });
  }
  return drafts;
}
