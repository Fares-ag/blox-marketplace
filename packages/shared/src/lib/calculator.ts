/** Simple declining-balance style monthly estimate (QAR). Not underwriting. */
export function estimateMonthlyPayment(opts: {
  price: number;
  downPayment: number;
  annualRatePercent: number;
  tenureMonths: number;
}): number {
  const principal = Math.max(opts.price - opts.downPayment, 0);
  const n = opts.tenureMonths;
  if (n <= 0) return 0;
  const r = opts.annualRatePercent / 100 / 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}
