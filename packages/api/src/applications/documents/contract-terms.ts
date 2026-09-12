import {
  buildInstallmentAmounts,
  paymentInputFromPricingSnapshot,
  roundMoney,
  sumInstallmentAmounts,
} from '@drivemarket/shared/pricing';
import { buildContractAmortizationSchedule, type ContractScheduleRow } from '../contract-pdf';
import type { ContractFieldContext } from './field-maps';

export type ResolvedContractTerms = {
  listPrice: number;
  downPayment: number;
  downPaymentPct: number;
  monthly: number;
  tenor: number;
  annualRate: number;
  financedTotal: number;
  schedule: ContractScheduleRow[];
};

/** Reconcile pricing snapshot fields so summary lines match the payment schedule. */
export function resolveContractTerms(
  pricing: Record<string, unknown>,
  approvedAt: Date,
): ResolvedContractTerms {
  const listPrice = roundMoney(Number(pricing.list_price ?? 0));
  let downPayment = roundMoney(Number(pricing.down_payment ?? 0));
  const pctFromSnapshot = Number(pricing.down_payment_pct ?? 0);

  if (listPrice > 0 && pctFromSnapshot > 0) {
    const pctDerived = roundMoney((listPrice * pctFromSnapshot) / 100);
    if (Math.abs(downPayment - pctDerived) > listPrice * 0.005) {
      downPayment = pctDerived;
    }
  }

  const input = paymentInputFromPricingSnapshot({
    ...pricing,
    list_price: listPrice,
    down_payment: downPayment,
  });
  const amounts = buildInstallmentAmounts(input);
  const monthly = amounts[0] ?? 0;
  const normalizedPricing = {
    ...pricing,
    list_price: listPrice,
    down_payment: downPayment,
    monthly,
    financed_total: sumInstallmentAmounts(amounts),
  };
  const schedule = buildContractAmortizationSchedule(normalizedPricing, approvedAt);
  const financedTotal = sumInstallmentAmounts(amounts);
  const downPaymentPct =
    listPrice > 0 ? roundMoney((downPayment / listPrice) * 100) : roundMoney(pctFromSnapshot);

  return {
    listPrice,
    downPayment,
    downPaymentPct,
    monthly: roundMoney(monthly),
    tenor: input.tenureMonths,
    annualRate: input.annualRatePercent,
    financedTotal,
    schedule,
  };
}

export function normalizeContractContext(ctx: ContractFieldContext): ContractFieldContext {
  const terms = resolveContractTerms(ctx.pricing, ctx.approvedAt);
  return {
    ...ctx,
    listPrice: terms.listPrice,
    downPayment: terms.downPayment,
    downPaymentPct: terms.downPaymentPct,
    monthly: terms.monthly,
    tenor: terms.tenor,
    annualRate: terms.annualRate,
    financedTotal: terms.financedTotal,
    schedule: terms.schedule,
  };
}
