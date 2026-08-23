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
import { roundMoney } from './pricing';
import { parseTenureToMonths } from './tenure';

type PaymentStatus = PaymentScheduleRow['status'];

/**
 * Generate dynamic-rent or flat schedule rows (wizard + fallback).
 * Matches vercel InstallmentPlanStep.generateSchedule behavior.
 */
export function generateInstallmentSchedule(args: {
  monthlyPayment: number;
  startDate: Date;
  totalMonths: number;
  carValue?: number;
  downPayment?: number;
  annualRentalRate?: number;
  paymentInterval?: string;
  /** When true, past periods are 'due' not 'paid' (detail page fallback). */
  reviewMode?: boolean;
}): PaymentScheduleRow[] {
  const {
    monthlyPayment,
    startDate,
    totalMonths,
    carValue,
    downPayment,
    annualRentalRate,
    paymentInterval,
    reviewMode = false,
  } = args;

  const schedule: PaymentScheduleRow[] = [];
  const now = startOfDay();
  const intervalValue = (paymentInterval ?? 'Monthly').toString().trim().toLowerCase();
  const isDaily = intervalValue === 'daily';

  const useDynamicRent =
    carValue !== undefined && downPayment !== undefined && annualRentalRate !== undefined;
  const loanAmount = useDynamicRent ? carValue - downPayment : 0;

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

  if (isDaily) {
    const rentPerDayRate = useDynamicRent ? annualRentalRate! / 365 : 0;
    let currentDate = startOfDay(startDate);
    let totalPrincipalPaid = 0;
    const principalPaymentPerMonth = useDynamicRent ? loanAmount / totalMonths : 0;

    for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
      const monthStart = startOfMonth(currentDate);
      const dim = daysInMonth(monthStart);
      const principalPaymentPerDay = principalPaymentPerMonth / dim;

      for (let dayInMonth = 0; dayInMonth < dim; dayInMonth++) {
        const dueDate = addDays(monthStart, dayInMonth);
        let paymentAmount = monthlyPayment;

        if (useDynamicRent) {
          const customerOwnership = downPayment! + totalPrincipalPaid;
          const bloxOwnership = carValue! - customerOwnership;
          const dailyRentForThisDay = bloxOwnership * rentPerDayRate;
          paymentAmount = principalPaymentPerDay + dailyRentForThisDay;
          totalPrincipalPaid += principalPaymentPerDay;
        } else {
          paymentAmount = monthlyPayment / dim;
        }

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
    const principalPaymentPerMonth = useDynamicRent ? loanAmount / totalMonths : 0;
    const rentPerPeriodRate = useDynamicRent ? annualRentalRate! / 12 : 0;

    for (let i = 0; i < totalMonths; i++) {
      const dueDate = addMonths(firstDueDate, i);
      const dueDateFormatted = formatDateYmd(dueDate);

      let paymentAmount = monthlyPayment;
      if (useDynamicRent) {
        const customerOwnership = downPayment! + principalPaymentPerMonth * i;
        const bloxOwnership = carValue! - customerOwnership;
        const monthlyRentForThisMonth = bloxOwnership * rentPerPeriodRate;
        paymentAmount = principalPaymentPerMonth + monthlyRentForThisMonth;
      }

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
  const monthlyAmount = plan.monthlyAmount || 0;
  const startDate = addMonths(startOfMonth(new Date()), 1);

  return generateInstallmentSchedule({
    monthlyPayment: monthlyAmount,
    startDate,
    totalMonths: tenureMonths,
    carValue: args.vehiclePrice,
    downPayment: plan.downPayment,
    annualRentalRate: plan.annualRentalRate,
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
    monthlyPayment: monthly,
    startDate,
    totalMonths: tenor,
    carValue: listPrice,
    downPayment,
    annualRentalRate: rate / 100,
    paymentInterval: args.interval ?? 'Monthly',
    reviewMode: true,
  });

  return {
    tenure: args.tenureLabel ?? `${tenor} Months`,
    interval: args.interval ?? 'Monthly',
    monthlyAmount: monthly,
    totalAmount: roundMoney(listPrice + (financedTotal - (monthly * tenor > 0 ? 0 : 0))),
    downPayment,
    schedule,
    annualRentalRate: rate / 100,
    calculationMethod: 'dynamic_rent',
  };
}
