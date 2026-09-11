/** Default nominal unit count for a diminishing musharakah contract. */
export const DEFAULT_TOTAL_UNITS = 100;

export type UnitSplit = {
  totalUnits: number;
  customerUnits: number;
  bloxUnits: number;
  vehiclePrice: number;
  unitNominalValue: number;
};

export type ProRataAllocation = {
  customerShare: number;
  bloxShare: number;
  customerUnits: number;
  bloxUnits: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampUnits(value: number, total: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(total, Math.round(value)));
}

/** Open the register from vehicle price and the customer's initial contribution. */
export function unitsFromDownPayment(
  vehiclePrice: number,
  downPayment: number,
  totalUnits = DEFAULT_TOTAL_UNITS,
): UnitSplit {
  const price = Math.max(0, vehiclePrice);
  const contribution = Math.max(0, Math.min(price, downPayment));
  const unitNominalValue = totalUnits > 0 && price > 0 ? roundMoney(price / totalUnits) : 0;
  const customerUnits =
    price <= 0 || unitNominalValue <= 0
      ? 0
      : clampUnits(contribution / unitNominalValue, totalUnits);
  return {
    totalUnits,
    customerUnits,
    bloxUnits: totalUnits - customerUnits,
    vehiclePrice: roundMoney(price),
    unitNominalValue,
  };
}

export function isMature(bloxUnits: number): boolean {
  return bloxUnits <= 0;
}

export function applyUnitPurchase(
  current: Pick<UnitSplit, 'totalUnits' | 'customerUnits' | 'bloxUnits'>,
  unitsPurchased: number,
): Pick<UnitSplit, 'totalUnits' | 'customerUnits' | 'bloxUnits'> {
  const bought = Math.max(0, Math.min(current.bloxUnits, Math.round(unitsPurchased)));
  return {
    totalUnits: current.totalUnits,
    customerUnits: current.customerUnits + bought,
    bloxUnits: current.bloxUnits - bought,
  };
}

/** Split insurance / sale proceeds in proportion to remaining units. */
export function proRataAllocation(
  customerUnits: number,
  bloxUnits: number,
  proceeds: number,
): ProRataAllocation {
  const total = Math.max(0, customerUnits + bloxUnits);
  const amount = Math.max(0, proceeds);
  if (total <= 0 || amount <= 0) {
    return { customerShare: 0, bloxShare: roundMoney(amount), customerUnits, bloxUnits };
  }
  const customerShare = roundMoney((customerUnits / total) * amount);
  return {
    customerShare,
    bloxShare: roundMoney(amount - customerShare),
    customerUnits,
    bloxUnits,
  };
}

/** Waterfall: rent (profit) first, remainder buys units. */
export function splitRentAndUnits(
  paymentAmount: number,
  rentDue: number,
  unitNominalValue: number,
): { rentCollected: number; unitPurchaseAmount: number; unitsBought: number } {
  const payment = Math.max(0, paymentAmount);
  const rent = Math.max(0, Math.min(payment, rentDue));
  const unitPurchaseAmount = roundMoney(payment - rent);
  const unitsBought =
    unitNominalValue > 0 ? Math.floor((unitPurchaseAmount + Number.EPSILON) / unitNominalValue) : 0;
  return {
    rentCollected: roundMoney(rent),
    unitPurchaseAmount,
    unitsBought,
  };
}

export function ownershipPctFromUnits(customerUnits: number, totalUnits: number): number {
  if (totalUnits <= 0) return 0;
  return Math.min(100, roundMoney((customerUnits / totalUnits) * 100));
}
