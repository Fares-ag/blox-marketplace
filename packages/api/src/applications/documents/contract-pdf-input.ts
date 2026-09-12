import type { ContractPdfInput } from '../contract-pdf';
import { readCustomerSnapshot } from '../customer-snapshot';
import { normalizeContractContext } from './contract-terms';
import type { ContractFieldContext } from './field-maps';

export function contractPdfInputFromContext(ctx: ContractFieldContext): ContractPdfInput {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  return {
    applicationId: normalized.applicationId,
    approvedAt: normalized.approvedAt.toISOString(),
    customerName: String(snap.full_name ?? ''),
    customerEmail: normalized.customerEmail,
    customerPhone: String(snap.phone ?? ''),
    customerQid: String(snap.qid ?? ''),
    vehicleLabel: `${normalized.vehicle.make} ${normalized.vehicle.model} ${normalized.vehicle.year ?? ''}`.trim(),
    dealerName: normalized.dealerName,
    listPrice: normalized.listPrice,
    downPayment: normalized.downPayment,
    downPaymentPct: normalized.downPaymentPct,
    monthly: normalized.monthly,
    tenor: normalized.tenor,
    annualRate: normalized.annualRate,
    financedTotal: normalized.financedTotal,
    lenderName: normalized.lenderName,
    schedule: normalized.schedule,
  };
}
