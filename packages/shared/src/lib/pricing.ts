const MINOR = 100;

export function roundMoney(amount: number): number {
  return Math.round(amount * MINOR) / MINOR;
}

export function toMinor(major: number): number {
  return Math.round(major * MINOR);
}

export function fromMinor(minor: number): number {
  return minor / MINOR;
}

export type MonthlyPaymentInput = {
  price: number;
  downPayment: number;
  annualRatePercent: number;
  tenureMonths: number;
};

/** Raw amortized monthly payment (full float precision). Declining-balance estimate, not underwriting. */
export function computeExactMonthlyPayment(opts: MonthlyPaymentInput): number {
  const principal = Math.max(opts.price - opts.downPayment, 0);
  const n = opts.tenureMonths;
  if (n <= 0) return 0;
  const r = opts.annualRatePercent / 100 / 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Equal-payment schedule with each installment rounded to 2 decimals (QAR fils).
 * Residual interest/principal drift is applied to the last installment so the
 * schedule sum equals the financed total exactly.
 */
export function buildInstallmentAmounts(opts: MonthlyPaymentInput): number[] {
  const n = opts.tenureMonths;
  if (n <= 0) return [];

  const exactMonthly = computeExactMonthlyPayment(opts);
  const totalMinor = Math.round(exactMonthly * n * MINOR);
  const regularMinor = Math.round(exactMonthly * MINOR);

  const amounts: number[] = [];
  for (let sequence = 1; sequence < n; sequence += 1) {
    amounts.push(fromMinor(regularMinor));
  }
  const priorMinor = regularMinor * (n - 1);
  amounts.push(fromMinor(totalMinor - priorMinor));
  return amounts;
}

/** Canonical monthly installment shown in UI and stored on pricing snapshots. */
export function estimateMonthlyPayment(opts: MonthlyPaymentInput): number {
  return buildInstallmentAmounts(opts)[0] ?? 0;
}

export function sumInstallmentAmounts(amounts: number[]): number {
  return roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
}

export function financedTotal(opts: MonthlyPaymentInput): number {
  return sumInstallmentAmounts(buildInstallmentAmounts(opts));
}

export type PricingInput = {
  listPrice: number;
  annualRatePercent: number;
  minDownPaymentPct: number;
  tenureMonths: number;
  downPaymentPct?: number;
};

export type PricingSnapshot = {
  list_price: number;
  down_payment: number;
  down_payment_pct: number;
  tenor: number;
  rate: number;
  monthly: number;
  financed_total: number;
};

/**
 * Keep a chosen down payment inside a band. `maxPct` defaults to the product
 * rules' ceiling (90%); pass the floor you actually want enforced — the apply
 * flow passes 0 so a customer's smaller contribution is priced as entered
 * rather than being silently raised to the recommended minimum.
 */
export function clampDownPaymentPct(
  downPct: number,
  minDownPaymentPct: number,
  maxPct = 90,
): number {
  const min = Number(minDownPaymentPct);
  const safe = Number.isFinite(downPct) ? downPct : min;
  return Math.min(Math.max(safe, min), maxPct);
}

export function buildPricingSnapshot(input: PricingInput): PricingSnapshot {
  const safeDownPct = clampDownPaymentPct(
    input.downPaymentPct ?? input.minDownPaymentPct,
    input.minDownPaymentPct,
  );
  const downPayment = roundMoney((input.listPrice * safeDownPct) / 100);
  const paymentInput: MonthlyPaymentInput = {
    price: input.listPrice,
    downPayment,
    annualRatePercent: input.annualRatePercent,
    tenureMonths: input.tenureMonths,
  };
  const amounts = buildInstallmentAmounts(paymentInput);
  return {
    list_price: input.listPrice,
    down_payment: downPayment,
    down_payment_pct: safeDownPct,
    tenor: input.tenureMonths,
    rate: input.annualRatePercent,
    monthly: amounts[0] ?? 0,
    financed_total: sumInstallmentAmounts(amounts),
  };
}

export function installmentAmountsFromPricingSnapshot(
  snapshot: Record<string, unknown>,
): number[] {
  const tenor = Number(snapshot.tenor ?? snapshot.tenure ?? 0);
  return buildInstallmentAmounts({
    price: Number(snapshot.list_price),
    downPayment: Number(snapshot.down_payment),
    annualRatePercent: Number(snapshot.rate),
    tenureMonths: tenor,
  });
}

export function paymentInputFromPricingSnapshot(
  snapshot: Record<string, unknown>,
): MonthlyPaymentInput {
  return {
    price: Number(snapshot.list_price),
    downPayment: Number(snapshot.down_payment),
    annualRatePercent: Number(snapshot.rate),
    tenureMonths: Number(snapshot.tenor ?? snapshot.tenure ?? 0),
  };
}

/**
 * Principal (equity) portion of each installment from declining-balance amortization.
 * Uses the same rounded installment amounts as {@link buildInstallmentAmounts}; residual
 * principal drift is absorbed on the final payment so the schedule sums to the loan.
 */
export function buildPrincipalAmounts(opts: MonthlyPaymentInput): number[] {
  const payments = buildInstallmentAmounts(opts);
  const n = payments.length;
  if (n === 0) return [];

  let balanceMinor = toMinor(Math.max(opts.price - opts.downPayment, 0));
  const r = opts.annualRatePercent / 100 / 12;
  const principals: number[] = [];

  for (let i = 0; i < n; i += 1) {
    const paymentMinor = toMinor(payments[i]);
    let principalMinor = 0;

    if (balanceMinor > 0) {
      if (r === 0) {
        principalMinor = i === n - 1 ? balanceMinor : Math.min(paymentMinor, balanceMinor);
      } else {
        const interestMinor = toMinor(roundMoney(fromMinor(balanceMinor) * r));
        principalMinor = paymentMinor - interestMinor;
        if (i === n - 1 || principalMinor > balanceMinor) {
          principalMinor = balanceMinor;
        }
        if (principalMinor < 0) {
          principalMinor = 0;
        }
      }
    }

    principals.push(fromMinor(principalMinor));
    balanceMinor = Math.max(0, balanceMinor - principalMinor);
  }

  return principals;
}

export function principalAmountsFromPricingSnapshot(
  snapshot: Record<string, unknown>,
): number[] {
  return buildPrincipalAmounts(paymentInputFromPricingSnapshot(snapshot));
}

/** Allocate scheduled principal proportionally when only part of an installment is paid. */
export function principalCollectedFromInstallment(
  paidAmount: number,
  scheduleAmount: number,
  scheduledPrincipal: number,
): number {
  if (paidAmount <= 0 || scheduleAmount <= 0 || scheduledPrincipal <= 0) {
    return 0;
  }
  if (paidAmount >= scheduleAmount) {
    return roundMoney(scheduledPrincipal);
  }
  return roundMoney((paidAmount / scheduleAmount) * scheduledPrincipal);
}
