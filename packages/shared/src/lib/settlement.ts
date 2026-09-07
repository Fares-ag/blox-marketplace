/**
 * Early settlement under Diminishing Musharakah.
 *
 * The customer buys Blox's remaining share: they owe the *principal* still
 * outstanding plus the *rent earned up to the settlement date*. Rent for
 * periods that have not elapsed is forgiven — charging it would be charging
 * for a benefit never received. Overdue installments are owed in full.
 *
 * Pure function so the web, mobile and API all quote the same number.
 */
import { principalAmountsFromPricingSnapshot, roundMoney } from './pricing';

export type SettlementScheduleRow = {
  sequence: number;
  dueDate: string | Date;
  amount: number;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  status?: string | null;
};

export type SettlementRowBreakdown = {
  sequence: number;
  dueDate: string;
  kind: 'settled' | 'overdue' | 'current' | 'future';
  principalOutstanding: number;
  rentOutstanding: number;
  accruedRent: number;
  forgivenRent: number;
};

export type EarlySettlementQuote = {
  asOf: string;
  principalOutstanding: number;
  accruedProfit: number;
  /** Full remaining amount of installments already past due (included in the settlement amount). */
  overdueAmount: number;
  forgivenRent: number;
  settlementAmount: number;
  /** What the customer would pay by simply completing the schedule. */
  remainingScheduled: number;
  savings: number;
  rows: SettlementRowBreakdown[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function monthBefore(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

function scheduledPrincipals(rows: SettlementScheduleRow[], pricingSnapshot: Record<string, unknown> | null | undefined): number[] {
  const fromSnapshot = pricingSnapshot ? safePrincipals(pricingSnapshot) : [];
  if (fromSnapshot.length === rows.length) return fromSnapshot;
  // Schedules that do not match the snapshot (rescheduled, imported): allocate the
  // financed amount across installments in proportion to their size.
  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const financed = Number(pricingSnapshot?.financed_amount ?? pricingSnapshot?.financedAmount ?? NaN);
  const principalTotal = Number.isFinite(financed) && financed > 0 ? financed : fromSnapshot.reduce((a, b) => a + b, 0);
  if (!(principalTotal > 0) || !(total > 0)) return rows.map((r) => Number(r.amount || 0));
  return rows.map((r) => roundMoney((Number(r.amount || 0) / total) * principalTotal));
}

function safePrincipals(snapshot: Record<string, unknown>): number[] {
  try {
    return principalAmountsFromPricingSnapshot(snapshot);
  } catch {
    return [];
  }
}

export function computeEarlySettlementQuote(input: {
  rows: SettlementScheduleRow[];
  pricingSnapshot?: Record<string, unknown> | null;
  asOf?: Date;
  /** Start of the first rent period (financing activation); defaults to a month before the first due date. */
  activatedAt?: Date | string | null;
}): EarlySettlementQuote {
  const asOf = input.asOf ?? new Date();
  const rows = [...input.rows].sort((a, b) => a.sequence - b.sequence);
  const principals = scheduledPrincipals(rows, input.pricingSnapshot);

  let principalOutstanding = 0;
  let accruedProfit = 0;
  let overdueAmount = 0;
  let forgivenRent = 0;
  let remainingScheduled = 0;
  const breakdown: SettlementRowBreakdown[] = [];

  rows.forEach((row, i) => {
    const amount = Number(row.amount || 0);
    const remaining = Math.max(0, Number(row.remainingAmount ?? amount - Number(row.paidAmount ?? 0)));
    const dueDate = asDate(row.dueDate);
    const unpaidFraction = amount > 0 ? Math.min(1, remaining / amount) : 0;
    const scheduledPrincipal = Math.min(principals[i] ?? 0, amount);
    const scheduledRent = Math.max(0, amount - scheduledPrincipal);
    const rowPrincipal = roundMoney(scheduledPrincipal * unpaidFraction);
    const rowRent = roundMoney(scheduledRent * unpaidFraction);
    remainingScheduled += remaining;

    let kind: SettlementRowBreakdown['kind'] = 'future';
    let accrued = 0;
    if (remaining <= 0) {
      kind = 'settled';
    } else if (dueDate.getTime() <= asOf.getTime()) {
      kind = 'overdue';
      accrued = rowRent;
      overdueAmount += remaining;
    } else {
      const periodStart = i > 0 ? asDate(rows[i - 1].dueDate) : input.activatedAt ? asDate(input.activatedAt) : monthBefore(dueDate);
      if (asOf.getTime() > periodStart.getTime()) {
        kind = 'current';
        const periodDays = Math.max(1, (dueDate.getTime() - periodStart.getTime()) / DAY_MS);
        const elapsedDays = Math.min(periodDays, (asOf.getTime() - periodStart.getTime()) / DAY_MS);
        accrued = roundMoney(rowRent * (elapsedDays / periodDays));
      }
    }

    if (kind !== 'settled') {
      principalOutstanding += rowPrincipal;
      accruedProfit += accrued;
      forgivenRent += roundMoney(rowRent - accrued);
    }
    breakdown.push({
      sequence: row.sequence,
      dueDate: dueDate.toISOString().slice(0, 10),
      kind,
      principalOutstanding: kind === 'settled' ? 0 : rowPrincipal,
      rentOutstanding: kind === 'settled' ? 0 : rowRent,
      accruedRent: accrued,
      forgivenRent: kind === 'settled' ? 0 : roundMoney(rowRent - accrued),
    });
  });

  const settlementAmount = roundMoney(principalOutstanding + accruedProfit);
  return {
    asOf: asOf.toISOString(),
    principalOutstanding: roundMoney(principalOutstanding),
    accruedProfit: roundMoney(accruedProfit),
    overdueAmount: roundMoney(overdueAmount),
    forgivenRent: roundMoney(forgivenRent),
    settlementAmount,
    remainingScheduled: roundMoney(remainingScheduled),
    savings: roundMoney(Math.max(0, remainingScheduled - settlementAmount)),
    rows: breakdown,
  };
}
