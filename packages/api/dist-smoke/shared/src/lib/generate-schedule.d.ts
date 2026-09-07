import type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
export declare function generateInstallmentSchedule(args: {
    monthlyPayment?: number;
    startDate: Date;
    totalMonths: number;
    carValue?: number;
    downPayment?: number;
    annualRentalRate?: number;
    annualRatePercent?: number;
    paymentInterval?: string;
    reviewMode?: boolean;
}): PaymentScheduleRow[];
export declare function generatePaymentScheduleFallback(args: {
    installmentPlan: InstallmentPlan;
    vehiclePrice?: number;
}): PaymentScheduleRow[];
export declare function resolveDownPaymentPercent(installmentPlan: InstallmentPlan | null | undefined, templateVehiclePrice: number): number;
export declare function planForVehicle(template: InstallmentPlan | null | undefined, vehiclePrice: number, downPaymentPercent: number): InstallmentPlan | null;
export declare function calculateAmortizedMonthlyPayment(principal: number, annualPercent: number, months: number): number;
export declare function buildPlanFromPricingSnapshot(args: {
    pricingSnapshot: Record<string, unknown>;
    tenureLabel?: string;
    interval?: string;
    vehiclePrice?: number;
}): InstallmentPlan;
