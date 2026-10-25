import { describe, expect, it } from 'vitest';
import {
  AL_JAZEERA_FINANCE_CODE,
  alJazeeraCriteriaFor,
  alJazeeraSegmentFor,
  employmentMonthsFromDuration,
  IN_HOUSE_FINANCE_CODE,
  IN_HOUSE_MAX_TENURE_MONTHS,
  IN_HOUSE_MIN_TENURE_MONTHS,
  isAlJazeeraFinance,
  isInHouseFinance,
  lenderApplicantIssues,
  lenderTenureBounds,
  privateSectorCarLimitViolation,
  resolveLenderCriteria,
} from './lender-criteria';

describe('Al Jazeera Finance criteria', () => {
  it('maps employment type to the published grid columns', () => {
    expect(alJazeeraSegmentFor('qatari', 'private_unlisted')).toBe('qatari');
    expect(alJazeeraSegmentFor('expat', 'government')).toBe('expat_govt_listed');
    expect(alJazeeraSegmentFor('expat', 'private_approved')).toBe('expat_govt_listed');
    expect(alJazeeraSegmentFor('expat', 'private_unlisted')).toBe('expat_private');
    expect(alJazeeraSegmentFor('expat', 'self_employed')).toBe('expat_private');
  });

  it('applies Qatari / expat govt / expat private rows', () => {
    const qatari = alJazeeraCriteriaFor('qatari');
    expect(qatari.minSalary).toBe(4_000);
    expect(qatari.maxFinancing).toBeNull();
    expect(qatari.maxTenureMonths).toBe(71);
    expect(qatari.dbrCap).toBe(0.75);
    expect(qatari.maxAgeAtMaturity).toBe(69);

    const govt = alJazeeraCriteriaFor('expat', 'government');
    expect(govt.minSalary).toBe(4_000);
    expect(govt.maxFinancing).toBe(200_000);
    expect(govt.maxTenureMonths).toBe(48);
    expect(govt.dbrCap).toBe(0.5);
    expect(govt.maxAgeAtMaturity).toBe(60);

    const privateExpat = alJazeeraCriteriaFor('expat', 'private_unlisted');
    expect(privateExpat.minSalary).toBe(5_000);
    expect(privateExpat.maxPrivateSectorCars).toBe(1);
  });

  it('only overlays when the lender is Al Jazeera', () => {
    expect(isAlJazeeraFinance(AL_JAZEERA_FINANCE_CODE)).toBe(true);
    expect(resolveLenderCriteria('blox-finance', 'qatari')).toBeNull();
    expect(resolveLenderCriteria(AL_JAZEERA_FINANCE_CODE, 'qatari')?.maxTenureMonths).toBe(71);
    expect(lenderTenureBounds(IN_HOUSE_FINANCE_CODE)).toEqual({
      min: IN_HOUSE_MIN_TENURE_MONTHS,
      max: IN_HOUSE_MAX_TENURE_MONTHS,
    });
    expect(lenderTenureBounds(AL_JAZEERA_FINANCE_CODE, 'expat')).toEqual({ min: 3, max: 48 });
    expect(lenderTenureBounds(AL_JAZEERA_FINANCE_CODE, 'qatari')).toEqual({ min: 3, max: 71 });
    expect(lenderTenureBounds('blox-finance')).toBeNull();
  });

  it('reads employment duration buckets and the one-car private-sector cap', () => {
    expect(employmentMonthsFromDuration('less-than-6-months')).toBe(0);
    expect(employmentMonthsFromDuration('between-6-12-months')).toBe(6);
    expect(employmentMonthsFromDuration('more-than-12-months')).toBe(12);
    expect(
      privateSectorCarLimitViolation(AL_JAZEERA_FINANCE_CODE, 'expat', 'private_unlisted', 1)?.code,
    ).toBe('private_sector_car_limit');
    expect(
      privateSectorCarLimitViolation(AL_JAZEERA_FINANCE_CODE, 'expat', 'government', 1),
    ).toBeNull();
    expect(privateSectorCarLimitViolation(AL_JAZEERA_FINANCE_CODE, 'qatari', 'private_unlisted', 2)).toBeNull();
  });

  it('flags applicant-side misses used by the dealer wizard', () => {
    expect(
      lenderApplicantIssues({
        lenderCode: AL_JAZEERA_FINANCE_CODE,
        residency: 'expat',
        employerCategory: 'private_unlisted',
        dateOfBirth: '2010-01-01',
        monthlyIncome: 3_000,
        employmentDuration: 'less-than-6-months',
        tenureMonths: 36,
        existingActiveCarCount: 1,
        now: new Date('2026-09-07T00:00:00Z'),
      }).map((i) => i.code),
    ).toEqual(['age_band', 'income_floor', 'employment_duration', 'car_limit']);
  });

  it('recognises only the in-house finance partner code', () => {
    expect(isInHouseFinance(IN_HOUSE_FINANCE_CODE)).toBe(true);
    expect(isInHouseFinance(AL_JAZEERA_FINANCE_CODE)).toBe(false);
    expect(isInHouseFinance('blox-finance')).toBe(false);
  });
});
