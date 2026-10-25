import type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
import { formatMonthsToTenure, parseTenureToMonths } from './tenure';
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

export type PaymentStatus =
  | 'due'
  | 'active'
  | 'paid'
  | 'unpaid'
  | 'partially_paid'
  | 'upcoming';

export interface BalloonPaymentConfig {
  vehiclePrice: number;
  downPayment: number;
  downPaymentPercent: number;
  installmentPercent: number;
  balloonPercent: number;
  termMonths: number;
  annualRentalRate: number;
  startDate: Date;
  interval?: string;
}

export interface BalloonPaymentCalculation {
  downPaymentAmount: number;
  totalInstallmentAmount: number;
  balloonAmount: number;
  principalPerMonth: number;
  schedule: PaymentScheduleRow[];
  totalRent: number;
  totalAmount: number;
}

export function validatePaymentStructure(
  downPaymentPercent: number,
  installmentPercent: number,
  balloonPercent: number,
): { isValid: boolean; error?: string } {
  const total = downPaymentPercent + installmentPercent + balloonPercent;
  const tolerance = 0.01;

  if (Math.abs(total - 100) > tolerance) {
    return {
      isValid: false,
      error: `Payment structure percentages must sum to 100%. Current total: ${total.toFixed(2)}%`,
    };
  }

  if (downPaymentPercent < 0 || installmentPercent < 0 || balloonPercent < 0) {
    return {
      isValid: false,
      error: 'Payment structure percentages cannot be negative',
    };
  }

  return { isValid: true };
}

export function calculateBalloonPaymentSchedule(
  config: BalloonPaymentConfig,
): BalloonPaymentCalculation {
  const {
    vehiclePrice,
    downPayment,
    downPaymentPercent,
    installmentPercent,
    balloonPercent,
    termMonths,
    annualRentalRate,
    startDate,
    interval = 'Monthly',
  } = config;

  const validation = validatePaymentStructure(
    downPaymentPercent,
    installmentPercent,
    balloonPercent,
  );
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid payment structure');
  }

  const downPaymentAmount =
    downPayment > 0 ? downPayment : vehiclePrice * (downPaymentPercent / 100);
  const totalInstallmentAmount = vehiclePrice * (installmentPercent / 100);
  const balloonAmount = vehiclePrice * (balloonPercent / 100);
  const principalPerMonth = termMonths > 0 ? totalInstallmentAmount / termMonths : 0;

  const schedule: PaymentScheduleRow[] = [];
  const now = startOfDay();
  const intervalValue = interval.toString().trim().toLowerCase();
  const isDaily = intervalValue === 'daily';
  const rentPerPeriodRate = annualRentalRate / (isDaily ? 365 : 12);
  let totalRent = 0;

  if (downPaymentAmount > 0) {
    const downPaymentDate = isDaily ? startOfDay(startDate) : startOfMonth(startDate);
    const isPast = isDaily
      ? isBeforeDay(downPaymentDate, now)
      : isBeforeMonth(downPaymentDate, now);
    const isToday = isDaily
      ? isSameDay(downPaymentDate, now)
      : isSameMonth(downPaymentDate, now);

    schedule.push({
      dueDate: formatDateYmd(downPaymentDate),
      amount: roundMoney(downPaymentAmount),
      status: isPast ? 'paid' : isToday ? 'active' : 'upcoming',
      paidDate: isPast ? formatDateYmd(downPaymentDate) : undefined,
      paymentType: 'down_payment',
      isBalloon: false,
    });
  }

  if (isDaily) {
    let currentDate = startOfDay(startDate);
    const endDate = addMonths(startDate, termMonths);

    for (let monthIndex = 0; monthIndex < termMonths; monthIndex++) {
      const monthStart = startOfMonth(currentDate);
      const dim = daysInMonth(monthStart);

      for (let dayInMonth = 0; dayInMonth < dim; dayInMonth++) {
        const dueDate = addDays(monthStart, dayInMonth);
        if (dueDate > endDate) break;

        const customerOwnership = downPaymentAmount + principalPerMonth * monthIndex;
        const remainingBalance = vehiclePrice - customerOwnership;
        const dailyRent = remainingBalance * rentPerPeriodRate;
        const dailyPrincipal = principalPerMonth / dim;
        const paymentAmount = dailyPrincipal + dailyRent;
        totalRent += dailyRent;

        const isPast = isBeforeDay(dueDate, now);
        const isToday = isSameDay(dueDate, now);

        schedule.push({
          dueDate: formatDateYmd(dueDate),
          amount: roundMoney(paymentAmount),
          status: isPast ? 'paid' : isToday ? 'active' : 'upcoming',
          paidDate: isPast ? formatDateYmd(dueDate) : undefined,
          paymentType: 'installment',
          isBalloon: false,
        });
      }

      currentDate = addMonths(monthStart, 1);
    }
  } else {
    const firstDueDate = startOfMonth(startDate);

    for (let i = 0; i < termMonths; i++) {
      const dueDate = addMonths(firstDueDate, i);
      const dueDateFormatted = formatDateYmd(dueDate);

      const customerOwnership = downPaymentAmount + principalPerMonth * i;
      const remainingBalance = vehiclePrice - customerOwnership;
      const monthlyRent = remainingBalance * rentPerPeriodRate;
      const paymentAmount = principalPerMonth + monthlyRent;
      totalRent += monthlyRent;

      const isPast = isBeforeMonth(dueDate, now);
      const isCurrentMonth = isSameMonth(dueDate, now);

      schedule.push({
        dueDate: dueDateFormatted,
        amount: roundMoney(paymentAmount),
        status: isPast ? 'paid' : isCurrentMonth ? 'active' : 'upcoming',
        paidDate: isPast ? dueDateFormatted : undefined,
        paymentType: 'installment',
        isBalloon: false,
      });
    }
  }

  const balloonDueDate = isDaily
    ? addDays(addMonths(startDate, termMonths), -1)
    : addMonths(startOfMonth(startDate), termMonths);

  const finalRent = isDaily
    ? balloonAmount * rentPerPeriodRate * daysInMonth(addMonths(startDate, termMonths))
    : balloonAmount * rentPerPeriodRate;
  const totalBalloonPayment = balloonAmount + finalRent;
  totalRent += finalRent;

  const isPast = isDaily
    ? isBeforeDay(balloonDueDate, now)
    : isBeforeMonth(balloonDueDate, now);
  const isCurrent = isDaily
    ? isSameDay(balloonDueDate, now)
    : isSameMonth(balloonDueDate, now);

  schedule.push({
    dueDate: formatDateYmd(balloonDueDate),
    amount: roundMoney(totalBalloonPayment),
    status: isPast ? 'paid' : isCurrent ? 'active' : 'upcoming',
    paidDate: isPast ? formatDateYmd(balloonDueDate) : undefined,
    paymentType: 'balloon_payment',
    isBalloon: true,
  });

  return {
    downPaymentAmount,
    totalInstallmentAmount,
    balloonAmount,
    principalPerMonth,
    schedule,
    totalRent: roundMoney(totalRent),
    totalAmount: roundMoney(vehiclePrice + totalRent),
  };
}

export function extractBalloonConfig(
  plan: InstallmentPlan,
  vehiclePrice: number,
): BalloonPaymentConfig | null {
  if (plan.calculationMethod !== 'balloon_payment') return null;
  const structure = plan.paymentStructure;
  if (!structure) return null;

  return {
    vehiclePrice,
    downPayment: plan.downPayment || 0,
    downPaymentPercent: structure.downPaymentPercent || 0,
    installmentPercent: structure.installmentPercent || 0,
    balloonPercent: structure.balloonPercent || 0,
    termMonths: parseTenureToMonths(plan.tenure),
    annualRentalRate: plan.annualRentalRate || 0,
    startDate: new Date(),
    interval: plan.interval,
  };
}

export const DEFAULT_IN_HOUSE_BALLOON_PCT = 30;

export type PaymentStructurePercents = {
  downPaymentPercent: number;
  installmentPercent: number;
  balloonPercent: number;
};

export function resolveBalloonStructure(
  downPaymentPercent: number,
  balloonPercent: number,
): PaymentStructurePercents {
  const down = Math.round((Number(downPaymentPercent) || 0) * 100) / 100;
  const balloon = Math.round((Number(balloonPercent) || 0) * 100) / 100;
  const installment = Math.round((100 - down - balloon) * 100) / 100;
  return { downPaymentPercent: down, installmentPercent: installment, balloonPercent: balloon };
}

/** Keep at least 1% for monthly principal so a balloon plan still has installments. */
export function clampBalloonPercent(downPaymentPercent: number, balloonPercent: number): number {
  const down = Math.max(0, Number(downPaymentPercent) || 0);
  const max = Math.max(0, Math.round((100 - down - 1) * 100) / 100);
  if (max < 1) return 0;
  const raw = Number(balloonPercent);
  const wanted = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IN_HOUSE_BALLOON_PCT;
  return Math.min(Math.max(Math.round(wanted * 100) / 100, 1), max);
}

export function isValidBalloonStructure(structure: PaymentStructurePercents): boolean {
  if (structure.downPaymentPercent < 0 || structure.installmentPercent <= 0 || structure.balloonPercent <= 0) {
    return false;
  }
  return validatePaymentStructure(
    structure.downPaymentPercent,
    structure.installmentPercent,
    structure.balloonPercent,
  ).isValid;
}

export function buildBalloonInstallmentPlan(args: {
  vehiclePrice: number;
  downPaymentPercent: number;
  balloonPercent: number;
  termMonths: number;
  annualRatePercent: number;
  startDate: Date;
  interval?: string;
}): InstallmentPlan {
  const structure = resolveBalloonStructure(args.downPaymentPercent, args.balloonPercent);
  const validation = validatePaymentStructure(
    structure.downPaymentPercent,
    structure.installmentPercent,
    structure.balloonPercent,
  );
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid payment structure');
  }

  const calc = calculateBalloonPaymentSchedule({
    vehiclePrice: args.vehiclePrice,
    downPayment: 0,
    downPaymentPercent: structure.downPaymentPercent,
    installmentPercent: structure.installmentPercent,
    balloonPercent: structure.balloonPercent,
    termMonths: args.termMonths,
    annualRentalRate: args.annualRatePercent / 100,
    startDate: args.startDate,
    interval: args.interval ?? 'Monthly',
  });
  const firstInstallment = calc.schedule.find((row) => row.paymentType === 'installment');
  const balloonRow = calc.schedule.find((row) => row.isBalloon);

  return {
    tenure: formatMonthsToTenure(args.termMonths),
    interval: args.interval ?? 'Monthly',
    monthlyAmount: firstInstallment?.amount ?? 0,
    totalAmount: calc.totalAmount,
    downPayment: calc.downPaymentAmount,
    schedule: calc.schedule,
    annualRentalRate: args.annualRatePercent / 100,
    calculationMethod: 'balloon_payment',
    balloonPayment: {
      amount: calc.balloonAmount,
      percentage: structure.balloonPercent,
      dueDate: balloonRow?.dueDate,
    },
    paymentStructure: structure,
  };
}

export function balloonPricingOverlay(plan: InstallmentPlan): Record<string, unknown> {
  const structure = plan.paymentStructure;
  const balloonAmount = plan.balloonPayment?.amount ?? 0;
  return {
    calculation_method: 'balloon_payment',
    installment_pct: structure?.installmentPercent ?? 0,
    balloon_pct: structure?.balloonPercent ?? 0,
    balloon: balloonAmount,
    monthly: plan.monthlyAmount,
    financed_total: roundMoney(
      plan.schedule
        .filter((row) => row.paymentType !== 'down_payment')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    ),
  };
}
