/**
 * Expiry reminder stages for vault documents (60/30/7 days) and takaful
 * policies (30/14/3 days). Each stage is sent once, recorded on the row as
 * `lastReminderKind`, and a later stage never re-sends an earlier one.
 */

export const DOCUMENT_REMINDER_THRESHOLDS: readonly number[] = [60, 30, 7];
export const TAKAFUL_REMINDER_THRESHOLDS: readonly number[] = [30, 14, 3];

export type ReminderKind = `d${number}` | 'expired';

/** Ordered stages for a threshold list, e.g. [60, 30, 7] → ['d60', 'd30', 'd7', 'expired']. */
export function reminderStages(thresholds: readonly number[]): ReminderKind[] {
  const descending = [...thresholds].sort((a, b) => b - a);
  return [...descending.map((t) => `d${t}` as ReminderKind), 'expired'];
}

/** Stage that applies to `daysToExpiry`; null while the expiry is still beyond the first threshold. */
export function reminderKindFor(daysToExpiry: number, thresholds: readonly number[]): ReminderKind | null {
  if (daysToExpiry < 0) return 'expired';
  const ascending = [...thresholds].sort((a, b) => a - b);
  const threshold = ascending.find((t) => daysToExpiry <= t);
  return threshold === undefined ? null : (`d${threshold}` as ReminderKind);
}

/** Send once per stage, only moving forward (after a d7 nudge, d30 stays silent; `expired` is final). */
export function shouldSendReminder(
  kind: ReminderKind | null,
  lastKind: string | null | undefined,
  thresholds: readonly number[],
): boolean {
  if (!kind) return false;
  if (!lastKind) return true;
  const stages = reminderStages(thresholds);
  return stages.indexOf(kind) > stages.indexOf(lastKind as ReminderKind);
}
