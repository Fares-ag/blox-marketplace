import {
  buildInstallmentAmounts,
  paymentInputFromPricingSnapshot,
  roundMoney,
  sumInstallmentAmounts,
} from '@drivemarket/shared/pricing';
import { buildPlanFromPricingSnapshot } from '@drivemarket/shared/installment-plan';
import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import {
  buildContractAmortizationSchedule,
  buildContractScheduleFromInstallmentPlan,
  type ContractScheduleRow,
} from '../contract-pdf';
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
  balloonAmount?: number;
  balloonPct?: number;
  balloonDueDate?: string;
  installmentPct?: number;
};

function resolveListPriceAndDown(pricing: Record<string, unknown>): {
  listPrice: number;
  downPayment: number;
  downPaymentPct: number;
} {
  const listPrice = roundMoney(Number(pricing.list_price ?? 0));
  let downPayment = roundMoney(Number(pricing.down_payment ?? 0));
  const pctFromSnapshot = Number(pricing.down_payment_pct ?? 0);

  if (listPrice > 0 && pctFromSnapshot > 0) {
    const pctDerived = roundMoney((listPrice * pctFromSnapshot) / 100);
    if (Math.abs(downPayment - pctDerived) > listPrice * 0.005) {
      downPayment = pctDerived;
    }
  }

  const downPaymentPct =
    listPrice > 0 ? roundMoney((downPayment / listPrice) * 100) : roundMoney(pctFromSnapshot);

  return { listPrice, downPayment, downPaymentPct };
}

function resolveBalloonPlan(
  pricing: Record<string, unknown>,
  approvedAt: Date,
  installmentPlan?: InstallmentPlan | null,
): InstallmentPlan | null {
  if (installmentPlan?.calculationMethod === 'balloon_payment' && installmentPlan.schedule?.length) {
    return installmentPlan;
  }
  if (pricing.calculation_method !== 'balloon_payment' && !(Number(pricing.balloon_pct) > 0)) {
    return null;
  }
  const built = buildPlanFromPricingSnapshot({ pricingSnapshot: pricing, asOf: approvedAt });
  return built.calculationMethod === 'balloon_payment' ? built : null;
}

function termsFromBalloonPlan(
  plan: InstallmentPlan,
  pricing: Record<string, unknown>,
  listPrice: number,
  downPayment: number,
  downPaymentPct: number,
): ResolvedContractTerms {
  const schedule = buildContractScheduleFromInstallmentPlan(plan, listPrice, downPayment);
  const installmentRows = (plan.schedule ?? []).filter((row) => row.paymentType === 'installment');
  const balloonRow = (plan.schedule ?? []).find((row) => row.isBalloon);
  const monthly = roundMoney(Number(installmentRows[0]?.amount ?? pricing.monthly ?? 0));
  const financedTotal = roundMoney(schedule.reduce((sum, row) => sum + row.payment, 0));
  const annualRate = Number(pricing.rate ?? (plan.annualRentalRate != null ? plan.annualRentalRate * 100 : 0));

  return {
    listPrice,
    downPayment,
    downPaymentPct,
    monthly,
    tenor: installmentRows.length || Number(pricing.tenor ?? pricing.tenure ?? 0),
    annualRate,
    financedTotal,
    schedule,
    balloonAmount:
      plan.balloonPayment?.amount != null && plan.balloonPayment.amount > 0
        ? plan.balloonPayment.amount
        : Number(pricing.balloon) > 0
          ? Number(pricing.balloon)
          : undefined,
    balloonPct:
      plan.paymentStructure?.balloonPercent != null && plan.paymentStructure.balloonPercent > 0
        ? plan.paymentStructure.balloonPercent
        : Number(pricing.balloon_pct) > 0
          ? Number(pricing.balloon_pct)
          : undefined,
    balloonDueDate: balloonRow?.dueDate ?? plan.balloonPayment?.dueDate,
    installmentPct:
      plan.paymentStructure?.installmentPercent != null && plan.paymentStructure.installmentPercent > 0
        ? plan.paymentStructure.installmentPercent
        : Number(pricing.installment_pct) > 0
          ? Number(pricing.installment_pct)
          : undefined,
  };
}

/** Reconcile pricing snapshot fields so summary lines match the payment schedule. */
export function resolveContractTerms(
  pricing: Record<string, unknown>,
  approvedAt: Date,
  installmentPlan?: InstallmentPlan | null,
): ResolvedContractTerms {
  const { listPrice, downPayment, downPaymentPct } = resolveListPriceAndDown(pricing);
  const balloonPlan = resolveBalloonPlan(pricing, approvedAt, installmentPlan);
  if (balloonPlan) {
    return termsFromBalloonPlan(balloonPlan, pricing, listPrice, downPayment, downPaymentPct);
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
  const terms = resolveContractTerms(ctx.pricing, ctx.approvedAt, ctx.installmentPlan);
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
    pricing: {
      ...ctx.pricing,
      list_price: terms.listPrice,
      down_payment: terms.downPayment,
      down_payment_pct: terms.downPaymentPct,
      monthly: terms.monthly,
      tenor: terms.tenor,
      rate: terms.annualRate,
      financed_total: terms.financedTotal,
      ...(terms.balloonAmount != null ? { balloon: terms.balloonAmount } : {}),
      ...(terms.balloonPct != null ? { balloon_pct: terms.balloonPct } : {}),
      ...(terms.installmentPct != null ? { installment_pct: terms.installmentPct } : {}),
      ...(terms.balloonDueDate ? { balloon_due_date: terms.balloonDueDate } : {}),
    },
  };
}
