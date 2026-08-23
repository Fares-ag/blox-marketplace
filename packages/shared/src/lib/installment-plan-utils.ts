import type { PaymentScheduleRow, PaymentStatus } from '../types/installment-plan';
import { monthKey, parseYmd } from './date-utils';

export type NormalizedInstallmentInterval = 'daily' | 'monthly' | 'other';

export function normalizeInstallmentInterval(interval?: string): NormalizedInstallmentInterval {
  const v = (interval || '').toString().trim().toLowerCase();
  if (v === 'daily') return 'daily';
  if (v === 'monthly') return 'monthly';
  return 'other';
}

export function isScheduleLikelyDaily(schedule: PaymentScheduleRow[]): boolean {
  if (!Array.isArray(schedule) || schedule.length === 0) return false;

  const counts = new Map<string, number>();
  for (const p of schedule) {
    const d = parseYmd(p.dueDate);
    if (Number.isNaN(d.getTime())) continue;
    const key = monthKey(d);
    const next = (counts.get(key) || 0) + 1;
    if (next > 1) return true;
    counts.set(key, next);
  }

  return false;
}

function aggregateMonthStatus(items: PaymentScheduleRow[]): PaymentStatus {
  if (items.length === 0) return 'upcoming';

  const statuses = items.map((p) => p.status).filter(Boolean) as PaymentStatus[];
  if (statuses.length === 0) return 'upcoming';

  const allPaid = statuses.every((s) => s === 'paid');
  if (allPaid) return 'paid';

  if (statuses.some((s) => s === 'unpaid' || s === 'overdue')) return 'unpaid';
  if (statuses.some((s) => s === 'partially_paid')) return 'partially_paid';
  if (statuses.some((s) => s === 'due')) return 'due';
  if (statuses.some((s) => s === 'active' || s === 'pending')) return 'active';
  return 'upcoming';
}

export function aggregateDailyScheduleToMonthly(
  schedule: PaymentScheduleRow[],
): PaymentScheduleRow[] {
  if (!Array.isArray(schedule) || schedule.length === 0) return [];

  const groups = new Map<string, PaymentScheduleRow[]>();

  for (const p of schedule) {
    const d = parseYmd(p.dueDate);
    if (Number.isNaN(d.getTime())) continue;
    const key = monthKey(d);
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  const months = Array.from(groups.keys()).sort();

  return months
    .map((monthKeyStr) => {
      const items = (groups.get(monthKeyStr) || [])
        .slice()
        .sort((a, b) => parseYmd(a.dueDate).getTime() - parseYmd(b.dueDate).getTime());

      if (items.length === 0) return null;

      const lastDue = parseYmd(items[items.length - 1]!.dueDate);
      const amount = items.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const status = aggregateMonthStatus(items);

      const paidDate =
        status === 'paid'
          ? items
              .map((p) => p.paidDate)
              .filter(Boolean)
              .map((d) => parseYmd(d as string))
              .filter((d) => !Number.isNaN(d.getTime()))
              .sort((a, b) => a.getTime() - b.getTime())
              .pop()
          : undefined;

      const isDeferred = items.some((p) => !!p.isDeferred);
      const isPartiallyDeferred = items.some((p) => !!p.isPartiallyDeferred);

      const out: PaymentScheduleRow = {
        dueDate: !Number.isNaN(lastDue.getTime())
          ? lastDue.toISOString().slice(0, 10)
          : `${monthKeyStr}-01`,
        amount,
        status,
        ...(paidDate ? { paidDate: paidDate.toISOString().slice(0, 10) } : {}),
        ...(isDeferred ? { isDeferred } : {}),
        ...(isPartiallyDeferred ? { isPartiallyDeferred } : {}),
      };

      return out;
    })
    .filter((p): p is PaymentScheduleRow => !!p && (Number(p.amount) || 0) > 0);
}
