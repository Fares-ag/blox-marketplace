import { financedAmountOf, monthlyInstallmentOf } from '../applications/credit-assessment';
import { formatApplicationRef } from '../applications/application-reference';
import { readCustomerSnapshot } from '../applications/customer-snapshot';

export type BureauScheduleRow = {
  status: string;
  remainingAmount: number;
  dueDate: Date;
  paidAt: Date | null;
};

export type BureauOwnershipRegister = {
  bloxUnits: number;
  customerUnits: number;
  totalUnits: number;
  unitNominalValue: number;
};

export type CanonicalSnapshotInput = {
  id: string;
  referenceSeq: number;
  status: string;
  activatedAt: Date;
  completedAt: Date | null;
  qid: string;
  defaultClassification: 'performing' | 'watch' | 'npl' | null;
  customerSnapshot: unknown;
  pricingSnapshot: unknown;
  register: BureauOwnershipRegister | null;
  schedules: BureauScheduleRow[];
  forgivenRentTotal: number;
  rentCollectedInPeriod: number;
};

export type CanonicalBureauFacility = {
  applicationId: string;
  facilityId: string;
  qid: string;
  fullName: string;
  nationality: string | null;
  dateOfBirth: string | null;
  applicantType: string;
  productType: 'diminishing_musharakah_vehicle';
  originalAmount: number;
  outstanding: number;
  outstandingSource: 'register' | 'schedule';
  ownershipPctCustomer: number | null;
  bloxUnits: number | null;
  totalUnits: number | null;
  installmentAmount: number;
  rentAmount: number;
  applicationStatus: string;
  defaultClassification: 'performing' | 'watch' | 'npl' | null;
  ibraAmount: number;
  activatedAt: string;
  completedAt: string | null;
  lastPaymentAt: string | null;
  arrearsAmount: number;
  arrearsCount: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ymd(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * BLOX facility facts for one reportable row. Outstanding prefers the
 * ownership register (BLOX units × unit nominal value). Rent is not mixed
 * into principal.
 */
export function toCanonicalBureauFacility(
  input: CanonicalSnapshotInput,
  asOf: Date,
): CanonicalBureauFacility {
  const snapshot = readCustomerSnapshot(input.customerSnapshot);
  const facilityId = formatApplicationRef(input.referenceSeq) ?? `BLOX-${input.referenceSeq}`;
  const register = input.register;
  let outstanding: number;
  let outstandingSource: 'register' | 'schedule';
  let ownershipPctCustomer: number | null = null;
  let bloxUnits: number | null = null;
  let totalUnits: number | null = null;

  if (register && register.unitNominalValue > 0 && register.totalUnits > 0) {
    outstanding = roundMoney(register.bloxUnits * Number(register.unitNominalValue));
    outstandingSource = 'register';
    bloxUnits = register.bloxUnits;
    totalUnits = register.totalUnits;
    ownershipPctCustomer = roundMoney((register.customerUnits / register.totalUnits) * 100);
  } else {
    outstanding = roundMoney(
      input.schedules.reduce((sum, row) => {
        if (row.status === 'paid' || row.status === 'waived') return sum;
        return sum + row.remainingAmount;
      }, 0),
    );
    outstandingSource = 'schedule';
  }

  const arrears = input.schedules.filter(
    (row) => row.status === 'overdue' || (row.status === 'pending' && row.dueDate < asOf),
  );
  const lastPaid = input.schedules
    .filter((row) => row.status === 'paid' && row.paidAt)
    .sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))[0];

  return {
    applicationId: input.id,
    facilityId,
    qid: input.qid,
    fullName: snapshot.full_name?.trim() || 'UNKNOWN',
    nationality: snapshot.nationality?.trim() || null,
    dateOfBirth: snapshot.dateOfBirth?.trim() || null,
    applicantType: snapshot.applicantType ?? 'individual',
    productType: 'diminishing_musharakah_vehicle',
    originalAmount: roundMoney(financedAmountOf(input.pricingSnapshot)),
    outstanding,
    outstandingSource,
    ownershipPctCustomer,
    bloxUnits,
    totalUnits,
    installmentAmount: roundMoney(monthlyInstallmentOf(input.pricingSnapshot)),
    rentAmount: roundMoney(input.rentCollectedInPeriod),
    applicationStatus: input.status,
    defaultClassification: input.defaultClassification,
    ibraAmount: roundMoney(input.forgivenRentTotal),
    activatedAt: ymd(input.activatedAt) ?? '',
    completedAt: ymd(input.completedAt),
    lastPaymentAt: ymd(lastPaid?.paidAt ?? null),
    arrearsAmount: roundMoney(arrears.reduce((sum, row) => sum + row.remainingAmount, 0)),
    arrearsCount: arrears.length,
  };
}
