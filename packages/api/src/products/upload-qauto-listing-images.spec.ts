import { describe, expect, it } from 'vitest';
import {
  resolveQautoSourceFile,
} from '../../prisma/upload-qauto-listing-images';
import type { QautoListing } from '../../prisma/seed-qauto-inventory';
import path from 'node:path';

const sourceDir = path.resolve(process.cwd(), 'assets/qauto-catalog');

describe('QAuto listing image upload', () => {
  it('resolves Audi catalog art by product id filename', async () => {
    const listing: QautoListing = {
      id: 'audi-q5-suv',
      make: 'Audi',
      model: 'Q5',
      trim: 'SUV',
      year: 2026,
      condition: 'new',
      engine: 'Q5',
      color: 'Silver',
      mileage: 0,
      price: 275000,
      description: 'Audi Q5 SUV',
      image: '/vehicles/audi-q5-suv.webp',
      attributes: [],
    };
    const resolved = await resolveQautoSourceFile(listing, sourceDir);
    expect(resolved?.kind).toBe('catalog');
    expect(resolved?.filePath.endsWith('audi-q5-suv.webp')).toBe(true);
  });

  it('uses Teramont placeholder for VW SUVs without dedicated renders', async () => {
    const listing: QautoListing = {
      id: 'vw-teramont-trendline-2-0l-pure-gray-2026',
      make: 'Volkswagen',
      model: 'Teramont',
      trim: 'Trendline 2.0L',
      year: 2026,
      condition: 'new',
      engine: '2.0L',
      color: 'Pure Gray',
      mileage: 0,
      price: 179900,
      description: 'Teramont Trendline 2.0L',
      image: null,
      attributes: [],
    };
    const resolved = await resolveQautoSourceFile(listing, sourceDir);
    expect(resolved?.kind).toBe('fallback');
    expect(resolved?.filePath.endsWith('vehicle-1-vw-teramont-grey.png')).toBe(true);
  });
});
