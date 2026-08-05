const qar = new Intl.NumberFormat('en-QA', {
  style: 'currency',
  currency: 'QAR',
  maximumFractionDigits: 0,
});

const qarExact = new Intl.NumberFormat('en-QA', {
  style: 'currency',
  currency: 'QAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatQar(amount: number, exact = false): string {
  return (exact ? qarExact : qar).format(amount);
}

export function formatPercent(rate: number): string {
  return `${rate.toFixed(2)}%`;
}
