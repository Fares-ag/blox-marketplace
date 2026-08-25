import type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
import { parseTenureToMonths } from './tenure';
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
    : addMonths(startOfMonth(startDate), termMonths + 1);

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
