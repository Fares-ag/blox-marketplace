import type { InstallmentPlan } from '../types/installment-plan';
import { roundMoney } from './pricing';

export function computeHideInterestDisplay(args: {
  sellingPrice: number;
  installmentPlan?: InstallmentPlan | null;
  internalAnnualRate?: number;
}): {
  customerDisplayPrice: number;
  customerDisplayRate: number;
  pricingSnapshot: Record<string, unknown>;
} {
  const sellingPrice = Number(args.sellingPrice) || 0;
  const plan = args.installmentPlan;
  const scheduleTotal =
    plan?.schedule?.reduce((s, row) => s + (Number(row.amount) || 0), 0) ?? 0;
  const downPayment = Number(plan?.downPayment) || 0;
  const totalPayable =
    scheduleTotal > 0 ? downPayment + scheduleTotal : Number(plan?.totalAmount) || sellingPrice;

  return {
    customerDisplayPrice: roundMoney(totalPayable),
    customerDisplayRate: 0,
    pricingSnapshot: {
      mode: 'hide_interest',
      sellingPrice,
      internalAnnualRate: args.internalAnnualRate ?? plan?.annualRentalRate ?? null,
      downPayment,
      scheduleTotal,
      totalPayable,
      computedAt: new Date().toISOString(),
    },
  };
}

export function getCustomerFacingPrice(app: {
  hideInterest?: boolean;
  customerDisplayPrice?: number | null;
  sellingPrice?: number | null;
  loanAmount?: number | null;
  downPayment?: number | null;
  product?: { price?: number | null };
  pricing_snapshot?: Record<string, unknown>;
}): number {
  if (app.hideInterest && app.customerDisplayPrice != null) {
    return Number(app.customerDisplayPrice) || 0;
  }
  const snap = app.pricing_snapshot;
  if (snap?.selling_price != null) return Number(snap.selling_price) || 0;
  if (app.sellingPrice != null) return Number(app.sellingPrice) || 0;
  const vehiclePrice = Number(app.product?.price) || 0;
  if (vehiclePrice > 0) return vehiclePrice;
  return (Number(app.loanAmount) || 0) + (Number(app.downPayment) || 0);
}

export function getCustomerFacingRatePercent(app: {
  hideInterest?: boolean;
  customerDisplayRate?: number | null;
  internalAnnualRate?: number | null;
  installment_plan?: InstallmentPlan | null;
  installmentPlan?: InstallmentPlan | null;
  offer?: { annual_rent_rate?: number; annualRentRate?: number };
  pricing_snapshot?: Record<string, unknown>;
}): number {
  if (app.hideInterest) {
    return app.customerDisplayRate != null ? Number(app.customerDisplayRate) : 0;
  }
  if (app.internalAnnualRate != null) {
    const r = Number(app.internalAnnualRate);
    return r <= 1 ? r * 100 : r;
  }
  const plan = app.installment_plan ?? app.installmentPlan;
  const planRate = plan?.annualRentalRate;
  if (planRate != null) {
    const r = Number(planRate);
    return r <= 1 ? r * 100 : r;
  }
  const snapRate = app.pricing_snapshot?.rate;
  if (snapRate != null) return Number(snapRate);
  return Number(app.offer?.annual_rent_rate ?? app.offer?.annualRentRate) || 0;
}
