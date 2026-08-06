const localeFormatters = new Map<string, Intl.NumberFormat>();

function getQarFormatter(locale: string, exact: boolean) {
  const key = `${locale}:${exact ? 'exact' : 'round'}`;
  if (!localeFormatters.has(key)) {
    localeFormatters.set(
      key,
      new Intl.NumberFormat(locale === 'ar' ? 'ar-QA' : 'en-QA', {
        style: 'currency',
        currency: 'QAR',
        maximumFractionDigits: exact ? 2 : 0,
        minimumFractionDigits: exact ? 2 : 0,
      }),
    );
  }
  return localeFormatters.get(key)!;
}

export function formatQar(amount: number, exact = false, locale = 'en'): string {
  return getQarFormatter(locale, exact).format(amount);
}

export function formatPercent(rate: number): string {
  return `${rate.toFixed(2)}%`;
}
