/**
 * Locale-aware date helpers for the customer pages. Arabic renders with the
 * `ar-QA` tag (Arabic-Indic digits, like the rest of the marketplace).
 */

export function localeTag(locale: string): string {
  return locale === 'ar' ? 'ar-QA' : 'en-QA';
}

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DEFAULT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function formatDate(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE,
): string {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(localeTag(locale), options) : '';
}

export function formatMonthYear(value: string | Date | null | undefined, locale: string): string {
  return formatDate(value, locale, { month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined, locale: string): string {
  const d = parseDate(value);
  return d
    ? d.toLocaleString(localeTag(locale), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}

export function formatTime(value: string | Date | null | undefined, locale: string): string {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString(localeTag(locale), { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Calendar days from `from` to `value` (negative when already past). */
export function daysUntil(value: string | Date | null | undefined, from: Date = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const target = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const base = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / 86_400_000);
}

/** Whole months still to go until `value`, rounded up (never negative). */
export function monthsUntil(value: string | Date | null | undefined, from: Date = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  let months = (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
  if (d.getDate() > from.getDate()) months += 1;
  return Math.max(0, months);
}

/** `YYYY-MM-DD` for `<input type="date">`, or '' when the value is missing/invalid. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}
