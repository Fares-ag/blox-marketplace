import { describe, expect, it } from 'vitest';
import { resolveQautoSourceFile } from '../../prisma/upload-qauto-listing-images';
import { loadQautoListings, type QautoListing } from '../../prisma/seed-qauto-inventory';
import path from 'node:path';

const sourceDir = path.resolve(process.cwd(), 'assets/qauto-catalog');

function listing(overrides: Partial<QautoListing>): QautoListing {
  return {
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
    ...overrides,
  };
}

describe('QAuto listing image upload', () => {
  it('resolves Audi catalog art by product id filename', async () => {
    const resolved = await resolveQautoSourceFile(listing({}), sourceDir);
    expect(resolved?.kind).toBe('catalog');
    expect(resolved?.filePath.endsWith('audi-q5-suv.webp')).toBe(true);
  });

  it('resolves VW SKUs to the shared model-family catalog render', async () => {
    const resolved = await resolveQautoSourceFile(
      listing({
        id: 'vw-teramont-trendline-2-0l-pure-gray-2026',
        make: 'Volkswagen',
        model: 'Teramont',
        trim: 'Trendline 2.0L',
        engine: '2.0L',
        color: 'Pure Gray',
        price: 179900,
        description: 'Teramont Trendline 2.0L',
        image: '/vehicles/vw-teramont.webp',
      }),
      sourceDir,
    );
    expect(resolved?.kind).toBe('catalog');
    expect(resolved?.filePath.endsWith('vw-teramont.webp')).toBe(true);
  });

  it('resolves Skoda SKUs to the shared model-family catalog render', async () => {
    const resolved = await resolveQautoSourceFile(
      listing({
        id: 'skoda-kodiaq-sportline-1-4-tsi-bronx-gold-pearlescent-2026',
        make: 'Skoda',
        model: 'Kodiaq',
        trim: 'Sportline 1.4 TSI',
        engine: '1.4 TSI',
        color: 'Bronx Gold Pearlescent',
        price: 149900,
        description: 'Skoda Kodiaq Sportline 1.4 TSI',
        image: '/vehicles/skoda-kodiaq.webp',
      }),
      sourceDir,
    );
    expect(resolved?.kind).toBe('catalog');
    expect(resolved?.filePath.endsWith('skoda-kodiaq.webp')).toBe(true);
  });

  it('keeps Octavia RS on its own sport-fascia render', async () => {
    const resolved = await resolveQautoSourceFile(
      listing({
        id: 'skoda-octavia-rs-2-0-tsi-black-magic-pearlescent-2026',
        make: 'Skoda',
        model: 'Octavia',
        trim: 'RS 2.0 TSI',
        engine: '2.0 TSI',
        color: 'Black Magic Pearlescent',
        price: 169900,
        description: 'Skoda Octavia RS 2.0 TSI',
        image: '/vehicles/skoda-octavia-rs.webp',
      }),
      sourceDir,
    );
    expect(resolved?.kind).toBe('catalog');
    expect(resolved?.filePath.endsWith('skoda-octavia-rs.webp')).toBe(true);
  });

  it('returns null instead of a placeholder when a listing has no catalog image', async () => {
    const resolved = await resolveQautoSourceFile(
      listing({ id: 'vw-jetta-no-art', make: 'Volkswagen', model: 'Jetta', image: null }),
      sourceDir,
    );
    expect(resolved).toBeNull();
  });

  it('resolves every seeded QAuto listing to a dedicated catalog file', async () => {
    const listings = loadQautoListings();
    const unresolved: string[] = [];
    for (const seeded of listings) {
      const resolved = await resolveQautoSourceFile(seeded, sourceDir);
      if (resolved?.kind !== 'catalog') unresolved.push(seeded.id);
    }
    expect(unresolved).toEqual([]);
  });

  it('maps VW and Skoda SKUs onto one render per model family', () => {
    const byMake = new Map<string, Map<string, Set<string>>>();
    for (const seeded of loadQautoListings()) {
      if (seeded.make === 'Audi') continue;
      const family =
        seeded.make === 'Skoda' && seeded.model === 'Octavia' && /^RS\b/i.test(seeded.trim)
          ? 'Octavia RS'
          : seeded.model;
      const families = byMake.get(seeded.make) ?? new Map<string, Set<string>>();
      const images = families.get(family) ?? new Set<string>();
      images.add(seeded.image ?? '');
      families.set(family, images);
      byMake.set(seeded.make, families);
    }
    for (const [, families] of byMake) {
      for (const [, images] of families) {
        expect(images.size).toBe(1);
      }
    }
    expect(byMake.get('Volkswagen')?.get('Tiguan')).toEqual(new Set(['/vehicles/vw-tiguan.webp']));
    expect(byMake.get('Skoda')?.get('Octavia')).toEqual(new Set(['/vehicles/skoda-octavia.webp']));
    expect(byMake.get('Skoda')?.get('Octavia RS')).toEqual(
      new Set(['/vehicles/skoda-octavia-rs.webp']),
    );
  });
});
