import type { CanonicalBureauFacility } from './canonical-snapshot';

/** Unsigned hypothesis map. Replace with Bureau samples as field-map.v2 after Finance + Sharia sign-off. */
export const BUREAU_MAP_VERSION = 'hypothesis-v1';
export const BUREAU_MAP_UNSIGNED = true;
export const BUREAU_PRODUCT_CODE = 'ISLAMIC_MUSHARAKAH_VEHICLE';

export type HypothesisCnssRecord = {
  qid: string;
  name: string;
  facilityId: string;
  product: string;
  originalAmount: string;
  outstanding: string;
  outstandingSource: string;
  ownershipPctCustomer: string;
  installmentAmount: string;
  rentAmount: string;
  applicationStatus: string;
  nplClass: string;
  ibraAmount: string;
  activatedAt: string;
  lastPaymentAt: string;
  arrearsAmount: string;
  arrearsCount: string;
};

function money(value: number): string {
  return value.toFixed(2);
}

function cell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).replaceAll('|', '/');
}

export function toHypothesisCnss(facility: CanonicalBureauFacility): HypothesisCnssRecord {
  return {
    qid: cell(facility.qid),
    name: cell(facility.fullName),
    facilityId: cell(facility.facilityId),
    product: BUREAU_PRODUCT_CODE,
    originalAmount: money(facility.originalAmount),
    outstanding: money(facility.outstanding),
    outstandingSource: facility.outstandingSource,
    ownershipPctCustomer:
      facility.ownershipPctCustomer == null ? '' : facility.ownershipPctCustomer.toFixed(2),
    installmentAmount: money(facility.installmentAmount),
    rentAmount: money(facility.rentAmount),
    applicationStatus: cell(facility.applicationStatus),
    nplClass: cell(facility.defaultClassification ?? 'performing'),
    ibraAmount: money(facility.ibraAmount),
    activatedAt: cell(facility.activatedAt),
    lastPaymentAt: cell(facility.lastPaymentAt),
    arrearsAmount: money(facility.arrearsAmount),
    arrearsCount: String(facility.arrearsCount),
  };
}

export function cnssLine(record: HypothesisCnssRecord): string {
  return [
    'CNSS',
    record.qid,
    record.name,
    record.facilityId,
    record.product,
    record.originalAmount,
    record.outstanding,
    record.outstandingSource,
    record.ownershipPctCustomer,
    record.installmentAmount,
    record.rentAmount,
    record.applicationStatus,
    record.nplClass,
    record.ibraAmount,
    record.activatedAt,
    record.lastPaymentAt,
    record.arrearsAmount,
    record.arrearsCount,
  ].join('|');
}
