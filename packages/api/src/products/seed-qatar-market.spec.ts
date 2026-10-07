import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_QATAR_MARKET_COUNT,
  QATAR_MARKET_DEALER_CODE,
  QATAR_MARKET_EXCLUDED_MAKES,
  loadQatarMarketListings,
} from '../../prisma/seed-qatar-market';

const catalogDir = path.resolve(process.cwd(), 'assets/qauto-catalog');

describe('Qatar-market inventory import', () => {
  it('loads the Qatar multi-brand showroom mix for Chery Elite Motors', () => {
    const listings = loadQatarMarketListings();
    expect(listings).toHaveLength(EXPECTED_QATAR_MARKET_COUNT);
    expect(QATAR_MARKET_DEALER_CODE).toBe('chery-elite-motors');
  });

  it('uses stable slugs, prices, and catalog image paths', () => {
    const listings = loadQatarMarketListings();
    const cruiser = listings.find((l) => l.id === 'toyota-land-cruiser-gxr-2026');
    expect(cruiser?.make).toBe('Toyota');
    expect(cruiser?.model).toBe('Land Cruiser');
    expect(cruiser?.price).toBe(420000);
    expect(cruiser?.image).toBe('/vehicles/toyota-land-cruiser.webp');
    expect(listings.find((l) => l.id === 'land-rover-defender-110-2026')?.image).toBe(
      '/vehicles/land-rover-defender.webp',
    );
  });

  it('has unique listing ids and one image per model', () => {
    const listings = loadQatarMarketListings();
    const ids = listings.map((l) => l.id);
    const images = listings.map((l) => l.image);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(images).size).toBe(images.length);
    for (const image of images) {
      expect(image).toMatch(/^\/vehicles\/[a-z0-9-]+\.webp$/);
    }
  });

  it('does not overlap QAuto or Chery makes', () => {
    const listings = loadQatarMarketListings();
    const makes = new Set(listings.map((l) => l.make));
    for (const excluded of QATAR_MARKET_EXCLUDED_MAKES) {
      expect(makes.has(excluded)).toBe(false);
    }
    expect(makes.has('Toyota')).toBe(true);
    expect(makes.has('Nissan')).toBe(true);
    expect(makes.has('Land Rover')).toBe(true);
  });

  it('points every listing at a bundled catalog file', async () => {
    const listings = loadQatarMarketListings();
    await Promise.all(
      listings.map(async (listing) => {
        const filename = listing.image?.replace(/^\/vehicles\//, '');
        expect(filename).toBeTruthy();
        await access(path.join(catalogDir, filename!));
      }),
    );
  });
});
