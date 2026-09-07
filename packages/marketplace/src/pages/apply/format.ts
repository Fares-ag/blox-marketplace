/** Locale-aware formatting helpers for the customer apply surfaces. */
import type { AppLocale } from '@drivemarket/shared';

export function localeTag(locale: AppLocale | string): string {
  return locale === 'ar' ? 'ar-QA' : 'en-QA';
}

export function formatDate(value: string | Date | null | undefined, locale: AppLocale | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeTag(locale), { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined, locale: AppLocale | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(localeTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatInteger(value: number, locale: AppLocale | string): string {
  return Math.round(value).toLocaleString(localeTag(locale));
}

/** 0.4321 → "43.2" (one decimal, no unit). */
export function formatRatioPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return (Math.round(ratio * 1000) / 10).toString();
}
