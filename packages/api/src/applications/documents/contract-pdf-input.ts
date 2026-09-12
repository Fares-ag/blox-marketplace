import type { ContractPdfInput } from '../contract-pdf';
import { readCustomerSnapshot } from '../customer-snapshot';
import type { ContractFieldContext } from './field-maps';

export function contractPdfInputFromContext(ctx: ContractFieldContext): ContractPdfInput {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  return {
    applicationId: ctx.applicationId,
    approvedAt: ctx.approvedAt.toISOString(),
    customerName: String(snap.full_name ?? ''),
    customerEmail: ctx.customerEmail,
    customerPhone: String(snap.phone ?? ''),
    customerQid: String(snap.qid ?? ''),
    vehicleLabel: `${ctx.vehicle.make} ${ctx.vehicle.model} ${ctx.vehicle.year ?? ''}`.trim(),
    dealerName: ctx.dealerName,
    listPrice: ctx.listPrice,
    downPayment: ctx.downPayment,
    downPaymentPct: ctx.downPaymentPct,
    monthly: ctx.monthly,
    tenor: ctx.tenor,
    annualRate: ctx.annualRate,
    financedTotal: ctx.financedTotal,
    lenderName: ctx.lenderName,
    schedule: ctx.schedule,
  };
}
