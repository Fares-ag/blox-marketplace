import { describe, expect, it } from 'vitest';
import {
  EXPECTED_AUDI_COUNT,
  EXPECTED_VW_COUNT,
  loadQautoListings,
} from '../../prisma/seed-qauto-inventory';

describe('QAuto inventory import', () => {
  it('loads 25 Audi and 32 Volkswagen SKUs from the committed JSON', () => {
    const listings = loadQautoListings();
    const audi = listings.filter((l) => l.make === 'Audi');
    const vw = listings.filter((l) => l.make === 'Volkswagen');
    expect(audi).toHaveLength(EXPECTED_AUDI_COUNT);
    expect(vw).toHaveLength(EXPECTED_VW_COUNT);
    expect(listings).toHaveLength(EXPECTED_AUDI_COUNT + EXPECTED_VW_COUNT);
  });

  it('uses stable slug ids that match blox-app catalog assets', () => {
    const listings = loadQautoListings();
    expect(listings.find((l) => l.id === 'audi-a3-sedan-35-tfsi')?.price).toBe(155000);
    expect(listings.find((l) => l.id === 'audi-q5-suv')?.image).toBe('/vehicles/audi-q5-suv.webp');
    expect(listings.find((l) => l.id === 'vw-teramont-trendline-2-0l-pure-gray-2026')?.make).toBe(
      'Volkswagen',
    );
  });

  it('has unique listing ids', () => {
    const listings = loadQautoListings();
    const ids = listings.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
