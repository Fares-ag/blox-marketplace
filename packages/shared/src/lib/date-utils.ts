/** Lightweight date helpers (no moment/dayjs). All dates are YYYY-MM-DD or Date. */

export function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseYmd(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!));
}

export function startOfDay(d = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfMonth(d: Date): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/** First installment due: the 1st of the month after `asOf`. */
export function firstInstallmentDueFrom(asOf: Date): Date {
  return addMonths(startOfMonth(asOf), 1);
}

/** Qatar-facing display: dd/MM/yyyy from a YYYY-MM-DD or Date. */
export function formatDateQa(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDateQa(parsed);
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBeforeMonth(a: Date, b: Date): boolean {
  const ay = a.getFullYear() * 12 + a.getMonth();
  const by = b.getFullYear() * 12 + b.getMonth();
  return ay < by;
}

export function isBeforeDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
