import type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
import {
  addDays,
  addMonths,
  daysInMonth,
  formatDateYmd,
  isBeforeDay,
  isBeforeMonth,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from './date-utils';
import { buildInstallmentAmounts, roundMoney, sumInstallmentAmounts } from './pricing';
import { parseTenureToMonths } from './tenure';

type PaymentStatus = PaymentScheduleRow['status'];

function splitMonthlyAmountAcrossDays(monthAmount: number, dim: number): number[] {
  if (dim <= 0) return [];
  const totalMinor = Math.round(monthAmount * 100);
  const regularMinor = Math.round((monthAmount / dim) * 100);
  const amounts: number[] = [];
  for (let d = 0; d < dim - 1; d += 1) {
    amounts.push(regularMinor / 100);
  }
  amounts.push((totalMinor - regularMinor * (dim - 1)) / 100);
  return amounts;
}

/**
 * Generate fixed amortized schedule rows (wizard + fallback).
 * Uses equal PMT-style installments via buildInstallmentAmounts.
 */
export function generateInstallmentSchedule(args: {
  monthlyPayment?: number;
  startDate: Date;
  totalMonths: number;
  carValue?: number;
  downPayment?: number;
  annualRentalRate?: number;
  annualRatePercent?: number;
  paymentInterval?: string;
  /** When true, past periods are 'due' not 'paid' (detail page fallback). */
  reviewMode?: boolean;
}): PaymentScheduleRow[] {
  const {
    startDate,
    totalMonths,
    carValue,
    downPayment,
    annualRentalRate,
    annualRatePercent,
    paymentInterval,
    reviewMode = false,
  } = args;

  const schedule: PaymentScheduleRow[] = [];
  const now = startOfDay();
  const intervalValue = (paymentInterval ?? 'Monthly').toString().trim().toLowerCase();
  const isDaily = intervalValue === 'daily';

  const hasPricing =
    carValue !== undefined && downPayment !== undefined && totalMonths > 0;
  const ratePercent =
    annualRatePercent ??
    (annualRentalRate !== undefined ? annualRentalRate * 100 : undefined);

  let installmentAmounts: number[] = [];
  if (hasPricing && ratePercent !== undefined) {
    installmentAmounts = buildInstallmentAmounts({
      price: carValue,
      downPayment,
      annualRatePercent: ratePercent,
      tenureMonths: totalMonths,
    });
  } else if (args.monthlyPayment && totalMonths > 0) {
    const flat = roundMoney(args.monthlyPayment);
    installmentAmounts = Array.from({ length: totalMonths }, () => flat);
  }

  const statusFor = (
    dueDate: Date,
    granularity: 'day' | 'month',
  ): PaymentStatus => {
    const isPast =
      granularity === 'day' ? isBeforeDay(dueDate, now) : isBeforeMonth(dueDate, now);
    const isCurrent =
      granularity === 'day' ? isSameDay(dueDate, now) : isSameMonth(dueDate, now);

    if (isPast) return reviewMode ? 'due' : 'paid';
    if (isCurrent) return 'active';
    return 'upcoming';
  };

  /* Dynamic rent (declining payments) — disabled in favour of amortized_fixed.
  const useDynamicRent =
    carValue !== undefined && downPayment !== undefined && annualRentalRate !== undefined;
  */

  if (isDaily) {
    let currentDate = startOfDay(startDate);

    for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
      const monthStart = startOfMonth(currentDate);
      const dim = daysInMonth(monthStart);
      const monthAmount = installmentAmounts[monthIndex] ?? 0;
      const dailyAmounts = splitMonthlyAmountAcrossDays(monthAmount, dim);

      for (let dayInMonth = 0; dayInMonth < dim; dayInMonth++) {
        const dueDate = addDays(monthStart, dayInMonth);
        const paymentAmount = dailyAmounts[dayInMonth] ?? 0;
        const status = statusFor(dueDate, 'day');
        const dueDateFormatted = formatDateYmd(dueDate);

        schedule.push({
          dueDate: dueDateFormatted,
          amount: roundMoney(paymentAmount),
          status,
          paidDate: status === 'paid' ? dueDateFormatted : undefined,
          paymentType: 'installment',
        });
      }

      currentDate = addMonths(monthStart, 1);
    }
  } else {
    const firstDueDate = new Date(startDate);

    for (let i = 0; i < totalMonths; i++) {
      const dueDate = addMonths(firstDueDate, i);
      const dueDateFormatted = formatDateYmd(dueDate);
      const paymentAmount = installmentAmounts[i] ?? 0;
      const status = statusFor(dueDate, 'month');

      schedule.push({
        dueDate: dueDateFormatted,
        amount: roundMoney(paymentAmount),
        status,
        paidDate: status === 'paid' ? dueDateFormatted : undefined,
        paymentType: 'installment',
      });
    }
  }

  return schedule;
}

/** Fallback when plan exists but schedule array is empty (vercel ApplicationDetailPage). */
export function generatePaymentScheduleFallback(args: {
  installmentPlan: InstallmentPlan;
  vehiclePrice?: number;
}): PaymentScheduleRow[] {
  const plan = args.installmentPlan;
  if (plan.schedule?.length) return plan.schedule;

  const tenureMonths = parseTenureToMonths(plan.tenure || '12 Months');
  const listPrice = args.vehiclePrice ?? 0;
  const downPayment = Number(plan.downPayment) || 0;
  const ratePercent =
    plan.annualRentalRate != null
      ? plan.annualRentalRate <= 1
        ? plan.annualRentalRate * 100
        : plan.annualRentalRate
      : 0;
  const startDate = addMonths(startOfMonth(new Date()), 1);

  return generateInstallmentSchedule({
    startDate,
    totalMonths: tenureMonths,
    carValue: listPrice,
    downPayment,
    annualRatePercent: ratePercent,
    paymentInterval: plan.interval,
    reviewMode: true,
  });
}

export function resolveDownPaymentPercent(
  installmentPlan: InstallmentPlan | null | undefined,
  templateVehiclePrice: number,
): number {
  if (!installmentPlan) return 0;
  if (installmentPlan.paymentStructure?.downPaymentPercent != null) {
    return installmentPlan.paymentStructure.downPaymentPercent;
  }
  const down = Number(installmentPlan.downPayment) || 0;
  if (templateVehiclePrice <= 0) return 0;
  return roundMoney((down / templateVehiclePrice) * 100);
}

/** Scale plan amounts for corporate multi-vehicle create. */
export function planForVehicle(
  template: InstallmentPlan | null | undefined,
  vehiclePrice: number,
  downPaymentPercent: number,
): InstallmentPlan | null {
  if (!template) return null;

  const templatePrice =
    Number(template.totalAmount) ||
    (Number(template.downPayment) || 0) +
      (template.schedule?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0);
  const templateDown = Number(template.downPayment) || 0;
  const templateLoan = Math.max(templatePrice - templateDown, 0);
  const downPayment = roundMoney((vehiclePrice * downPaymentPercent) / 100);
  const loanAmount = Math.max(vehiclePrice - downPayment, 0);
  const scale = templateLoan > 0 ? loanAmount / templateLoan : 1;

  const schedule = (template.schedule ?? []).map((row) => ({
    ...row,
    amount: roundMoney((Number(row.amount) || 0) * scale),
    status: 'upcoming' as const,
    paidDate: undefined,
    paidAmount: undefined,
  }));

  return {
    ...template,
    downPayment,
    monthlyAmount: roundMoney((template.monthlyAmount || 0) * scale),
    totalAmount: roundMoney(vehiclePrice + (Number(template.totalAmount) - templatePrice || 0) * scale),
    schedule,
  };
}

export function calculateAmortizedMonthlyPayment(
  principal: number,
  annualPercent: number,
  months: number,
): number {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualPercent / 100 / 12;
  if (r <= 0) return roundMoney(principal / months);
  const pow = Math.pow(1 + r, months);
  return roundMoney((principal * r * pow) / (pow - 1));
}

export function buildPlanFromPricingSnapshot(args: {
  pricingSnapshot: Record<string, unknown>;
  tenureLabel?: string;
  interval?: string;
  vehiclePrice?: number;
}): InstallmentPlan {
  const snap = args.pricingSnapshot;
  const tenor = Number(snap.tenor ?? snap.tenure ?? 12);
  const listPrice = Number(snap.list_price ?? snap.selling_price ?? args.vehiclePrice ?? 0);
  const downPayment = Number(snap.down_payment ?? 0);
  const rate = Number(snap.rate ?? 0);
  const monthly = Number(snap.monthly ?? 0);
  const financedTotal = Number(snap.financed_total ?? monthly * tenor);

  const startDate = addMonths(startOfMonth(new Date()), 1);
  const schedule = generateInstallmentSchedule({
    startDate,
    totalMonths: tenor,
    carValue: listPrice,
    downPayment,
    annualRatePercent: rate,
    paymentInterval: args.interval ?? 'Monthly',
    reviewMode: true,
  });

  const scheduleTotal = sumInstallmentAmounts(schedule.map((r) => Number(r.amount)));

  return {
    tenure: args.tenureLabel ?? `${tenor} Months`,
    interval: args.interval ?? 'Monthly',
    monthlyAmount: schedule[0]?.amount ?? monthly,
    totalAmount: roundMoney(downPayment + scheduleTotal),
    downPayment,
    schedule,
    annualRentalRate: rate / 100,
    calculationMethod: 'amortized_fixed',
  };
}
