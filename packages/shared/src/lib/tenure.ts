export const MIN_TENURE_MONTHS = 1;
export const MAX_TENURE_MONTHS = 60;

export const TENURE_PRESET_MONTHS = [12, 24, 36, 48, 60] as const;

export function isTenureInRange(months: number): boolean {
  return Number.isFinite(months) && months >= MIN_TENURE_MONTHS && months <= MAX_TENURE_MONTHS;
}

export function clampTenureMonths(months: number): number {
  if (!Number.isFinite(months)) return MIN_TENURE_MONTHS;
  return Math.min(Math.max(Math.round(months), MIN_TENURE_MONTHS), MAX_TENURE_MONTHS);
}

export function parseTenureToMonths(tenureStr: string): number {
  if (!tenureStr) return 12;

  const yearMatch = tenureStr.match(/(\d+)\s*year/i);
  const monthMatch = tenureStr.match(/(\d+)\s*month/i);

  const years = yearMatch ? parseInt(yearMatch[1]!, 10) : 0;
  const months = monthMatch ? parseInt(monthMatch[1]!, 10) : 0;

  if (yearMatch || monthMatch) {
    return clampTenureMonths(years * 12 + months);
  }

  const n = parseInt(tenureStr.replace(/\D/g, ''), 10);
  return clampTenureMonths(Number.isFinite(n) && n > 0 ? n : MIN_TENURE_MONTHS);
}

export function formatMonthsToTenure(months: number): string {
  if (months <= 0) return '12 Months';

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths === 0) {
    return `${years} Year${years > 1 ? 's' : ''}`;
  }

  return `${months} Months`;
}
