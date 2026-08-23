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
