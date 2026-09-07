import {
  computeEarlySettlementQuote,
  type EarlySettlementQuote,
  type SettlementScheduleRow,
} from '@drivemarket/shared/domain-rules';

/**
 * Early settlement under Diminishing Musharakah: the customer buys Blox's
 * remaining share (principal outstanding) plus the rent earned up to the quote
 * date; rent for periods that have not elapsed is forgiven, overdue
 * installments are owed in full. The maths is the shared
 * `computeEarlySettlementQuote`; this file adapts Prisma rows to it and shapes
 * the wire DTO. Pure — unit-tested without a database.
 */

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function asNumber(value: DecimalLike): number {
  if (value == null) return 0;
  const n = typeof value === 'object' ? value.toNumber() : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Matches `SettlementQuoteRowDto` in packages/shared/src/types/customer-platform.ts field for field. */
export type SettlementQuoteRowDto = {
  sequence: number;
  due_date: string;
  kind: 'settled' | 'overdue' | 'current' | 'future';
  principal_outstanding: number;
  rent_outstanding: number;
  accrued_rent: number;
  forgiven_rent: number;
};

/** Matches `SettlementQuoteDto` in packages/shared/src/types/customer-platform.ts field for field. */
export type SettlementQuoteDto = {
  as_of: string;
  principal_outstanding: number;
  accrued_profit: number;
  overdue_amount: number;
  forgiven_rent: number;
  settlement_amount: number;
  remaining_scheduled: number;
  savings: number;
  rows: SettlementQuoteRowDto[];
};

export type SettlementScheduleSource = {
  sequence: number;
  dueDate: Date | string;
  amount: DecimalLike;
  paidAmount?: DecimalLike;
  remainingAmount?: DecimalLike;
  status?: string | null;
};

export type SettlementQuoteSource = {
  paymentSchedules: SettlementScheduleSource[];
  pricingSnapshot: unknown;
  activatedAt?: Date | string | null;
};

export function settlementRowsFrom(schedules: SettlementScheduleSource[]): SettlementScheduleRow[] {
  return schedules.map((row) => ({
    sequence: row.sequence,
    dueDate: row.dueDate,
    amount: asNumber(row.amount),
    paidAmount: row.paidAmount == null ? null : asNumber(row.paidAmount),
    remainingAmount: row.remainingAmount == null ? null : asNumber(row.remainingAmount),
    status: row.status ?? null,
  }));
}

/** Live quote over the application's schedule ledger and locked pricing. */
export function quoteForApplication(source: SettlementQuoteSource, asOf: Date = new Date()): EarlySettlementQuote {
  const pricing =
    source.pricingSnapshot && typeof source.pricingSnapshot === 'object'
      ? (source.pricingSnapshot as Record<string, unknown>)
      : null;
  return computeEarlySettlementQuote({
    rows: settlementRowsFrom(source.paymentSchedules),
    pricingSnapshot: pricing,
    asOf,
    activatedAt: source.activatedAt ?? null,
  });
}

export function toSettlementQuoteDto(quote: EarlySettlementQuote): SettlementQuoteDto {
  return {
    as_of: quote.asOf,
    principal_outstanding: quote.principalOutstanding,
    accrued_profit: quote.accruedProfit,
    overdue_amount: quote.overdueAmount,
    forgiven_rent: quote.forgivenRent,
    settlement_amount: quote.settlementAmount,
    remaining_scheduled: quote.remainingScheduled,
    savings: quote.savings,
    rows: quote.rows.map((row) => ({
      sequence: row.sequence,
      due_date: row.dueDate,
      kind: row.kind,
      principal_outstanding: row.principalOutstanding,
      rent_outstanding: row.rentOutstanding,
      accrued_rent: row.accruedRent,
      forgiven_rent: row.forgivenRent,
    })),
  };
}

/** Column values a settlement request stores from its quote. */
export function settlementRequestValues(quote: EarlySettlementQuote): {
  settlementAmount: number;
  remainingPrincipal: number;
  forgivenRent: number;
  accruedProfit: number;
  quoteAsOf: Date;
} {
  return {
    settlementAmount: quote.settlementAmount,
    remainingPrincipal: quote.principalOutstanding,
    forgivenRent: quote.forgivenRent,
    accruedProfit: quote.accruedProfit,
    quoteAsOf: new Date(quote.asOf),
  };
}

/** What the customer keeps by settling now versus finishing the schedule (forgiven rent plus any ops discount). */
export function settlementSavings(row: { forgivenRent: DecimalLike; discountAmount?: DecimalLike }): number {
  return Math.round((asNumber(row.forgivenRent) + asNumber(row.discountAmount)) * 100) / 100;
}
