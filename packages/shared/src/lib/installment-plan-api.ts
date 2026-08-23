export {
  generateInstallmentSchedule,
  generatePaymentScheduleFallback,
  resolveDownPaymentPercent,
  planForVehicle,
  calculateAmortizedMonthlyPayment,
  buildPlanFromPricingSnapshot,
} from './generate-schedule';
export type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
