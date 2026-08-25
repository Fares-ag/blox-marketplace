/**
 * Generates Skoda QAuto inventory entries from dealer price list + Skoda Qatar specs.
 * Appends to prisma/qauto-inventory-import.json (idempotent when re-run after manual cleanup).
 *
 * Usage (from packages/api):
 *   node scripts/generate-skoda-inventory.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, '..');
const OUT = path.join(apiRoot, 'prisma/qauto-inventory-import.json');

/** Qatar specs sourced from skoda-auto-qatar.com model pages (Aug 2026). */
const SKODA_CATALOG = [
  {
    model: 'Karoq',
    trim: 'Selection 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 99900,
    family: 'karoq',
    colors: [
      'Black Magic Pearlescent',
      'Steel Grey',
      'Race Blue Metallic',
      'Brilliant Silver Metallic',
      'Graphite Grey Metallic',
      'Moon White Metallic',
    ],
    specs: {
      body_style: 'SUV',
      seating_capacity: '5',
      horsepower: '150',
      torque_nm: '250',
      transmission: '8-speed automatic',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '16.6',
    },
  },
  {
    model: 'Karoq',
    trim: 'Sportline 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 127900,
    family: 'karoq',
    colors: [
      'Black Magic Pearlescent',
      'Graphite Grey Metallic',
      'Velvet Red Metallic',
      'Steel Grey',
    ],
    specs: {
      body_style: 'SUV',
      seating_capacity: '5',
      horsepower: '150',
      torque_nm: '250',
      transmission: '8-speed automatic',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '16.6',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Sportline 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 176900,
    family: 'kodiaq',
    colors: [
      'Brilliant Silver Metallic',
      'Bronx Gold Pearlescent',
      'Graphite Grey Metallic',
      'Steel Grey',
    ],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'All Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Selection Plus 2.0 TSI',
    engine: '2.0 TSI',
    year: 2025,
    price: 173900,
    family: 'kodiaq',
    colors: ['Black Magic Pearlescent', 'Graphite Grey Metallic', 'Brilliant Silver Metallic'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '190',
      torque_nm: '320',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '12.3',
      fuel_tank_l: '58',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Selection Loft 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 143900,
    family: 'kodiaq',
    colors: ['Race Blue Metallic', 'Bronx Gold Pearlescent'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Selection Plus 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 166900,
    family: 'kodiaq',
    colors: ['Bronx Gold Pearlescent'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Essence 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 124900,
    family: 'kodiaq',
    colors: ['Steel Grey', 'Bronx Gold Pearlescent'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Selection Plus NPS 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 163900,
    family: 'kodiaq',
    colors: ['Black Magic Pearlescent'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kodiaq',
    trim: 'Essence Plus 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 131900,
    family: 'kodiaq',
    colors: ['Moon White Metallic', 'Steel Grey', 'Black Magic Pearlescent'],
    specs: {
      body_style: 'SUV',
      seating_capacity: '7',
      horsepower: '150',
      torque_nm: '250',
      transmission: '7-speed DSG',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '14.6',
      fuel_tank_l: '55',
    },
  },
  {
    model: 'Kushaq',
    trim: 'Ambition 1.0 TSI',
    engine: '1.0 TSI',
    year: 2026,
    price: 69450,
    family: 'kushaq',
    colors: [
      'Reflex Silver Metallic',
      'Candy White',
      'Carbon Steel',
      'Lava Blue Metallic',
    ],
    specs: {
      body_style: 'SUV',
      seating_capacity: '5',
      horsepower: '114',
      torque_nm: '175',
      transmission: '6-speed automatic',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '16.8',
    },
  },
  {
    model: 'Octavia',
    trim: 'RS 2.0 TSI',
    engine: '2.0 TSI',
    year: 2026,
    price: 146900,
    family: 'octavia',
    colors: ['Black Magic Pearlescent'],
    specs: {
      body_style: 'Sedan',
      seating_capacity: '5',
      horsepower: '265',
      torque_nm: '370',
      transmission: '7-speed automatic',
      drive_type: 'Front Wheel Drive',
      fuel_consumption_km_l: '15.7',
    },
  },
  {
    model: 'Octavia',
    trim: 'Selection 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 119900,
    family: 'octavia',
    colors: ['Graphite Grey Metallic', 'Moon White Metallic'],
    specs: {
      body_style: 'Sedan',
      seating_capacity: '5',
      horsepower: '150',
      torque_nm: '250',
      transmission: 'Automatic',
      drive_type: 'Front Wheel Drive',
    },
  },
  {
    model: 'Octavia',
    trim: 'Sportline 1.4 TSI',
    engine: '1.4 TSI',
    year: 2026,
    price: 124900,
    family: 'octavia',
    colors: ['Moon White Metallic'],
    specs: {
      body_style: 'Sedan',
      seating_capacity: '5',
      horsepower: '150',
      torque_nm: '250',
      transmission: 'Automatic',
      drive_type: 'Front Wheel Drive',
    },
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildAttributes(entry, color, id) {
  const attrs = Object.entries(entry.specs).map(([key, value]) => ({
    id: key,
    name: key,
    value,
  }));
  attrs.push(
    { id: 'model_family_key', name: 'model_family_key', value: entry.family },
    { id: 'sku_key', name: 'sku_key', value: id },
    { id: 'stock_qty', name: 'stock_qty', value: '1' },
  );
  return attrs;
}

function buildListings() {
  const listings = [];
  for (const entry of SKODA_CATALOG) {
    const trimSlug = slugify(entry.trim);
    for (const color of entry.colors) {
      const colorSlug = slugify(color);
      const id = `skoda-${slugify(entry.model)}-${trimSlug}-${colorSlug}-${entry.year}`;
      listings.push({
        id,
        make: 'Skoda',
        model: entry.model,
        trim: entry.trim,
        year: entry.year,
        condition: 'new',
        engine: entry.engine,
        color,
        mileage: 0,
        price: entry.price,
        description: `Skoda ${entry.model} ${entry.trim}`,
        image: null,
        attributes: buildAttributes(entry, color, id),
      });
    }
  }
  return listings;
}

function main() {
  const skoda = buildListings();
  const raw = readFileSync(OUT, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw);
  const withoutSkoda = (payload.listings ?? []).filter((l) => l.make !== 'Skoda');
  payload.source = {
    ...payload.source,
    skoda: 'generate-skoda-inventory.mjs (Skoda Qatar official specs)',
    skoda_generated_at: new Date().toISOString(),
  };
  payload.listings = [...withoutSkoda, ...skoda];
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${skoda.length} Skoda listings (${payload.listings.length} total)`);
}

main();
