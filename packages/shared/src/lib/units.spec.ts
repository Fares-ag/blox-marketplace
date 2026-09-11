import { describe, expect, it } from 'vitest';
import {
  applyUnitPurchase,
  isMature,
  ownershipPctFromUnits,
  proRataAllocation,
  splitRentAndUnits,
  unitsFromDownPayment,
} from './units';

describe('units', () => {
  it('opens a 100-unit register from the initial contribution', () => {
    const split = unitsFromDownPayment(100_000, 20_000);
    expect(split.totalUnits).toBe(100);
    expect(split.customerUnits).toBe(20);
    expect(split.bloxUnits).toBe(80);
    expect(split.unitNominalValue).toBe(1000);
  });

  it('matures when Blox units hit zero', () => {
    const after = applyUnitPurchase({ totalUnits: 100, customerUnits: 99, bloxUnits: 1 }, 1);
    expect(after.bloxUnits).toBe(0);
    expect(isMature(after.bloxUnits)).toBe(true);
    expect(ownershipPctFromUnits(after.customerUnits, after.totalUnits)).toBe(100);
  });

  it('allocates total-loss proceeds pro rata', () => {
    const alloc = proRataAllocation(25, 75, 80_000);
    expect(alloc.customerShare).toBe(20_000);
    expect(alloc.bloxShare).toBe(60_000);
  });

  it('splits rent before unit purchase', () => {
    const split = splitRentAndUnits(2700, 200, 1000);
    expect(split.rentCollected).toBe(200);
    expect(split.unitPurchaseAmount).toBe(2500);
    expect(split.unitsBought).toBe(2);
  });
});
