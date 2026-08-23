export function parseTenureToMonths(tenureStr: string): number {
  if (!tenureStr) return 12;

  const yearMatch = tenureStr.match(/(\d+)\s*year/i);
  const monthMatch = tenureStr.match(/(\d+)\s*month/i);

  const years = yearMatch ? parseInt(yearMatch[1]!, 10) : 0;
  const months = monthMatch ? parseInt(monthMatch[1]!, 10) : 0;

  if (yearMatch || monthMatch) {
    return years * 12 + months;
  }

  const n = parseInt(tenureStr.replace(/\D/g, ''), 10);
  return (Number.isFinite(n) && n > 0 ? n : 1) * 12;
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
