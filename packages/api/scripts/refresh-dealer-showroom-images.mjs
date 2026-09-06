/**
 * Refresh dealer showroom inventory images via production API.
 * Deletes existing listings (no active applications) and re-creates them with catalog photos.
 *
 * Usage:
 *   node packages/api/scripts/refresh-dealer-showroom-images.mjs
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.API_URL ?? 'https://api.blox.market';
const DEALER_ORIGIN = process.env.DEALER_ORIGIN ?? 'https://dealer.blox.market';
const OPS_ORIGIN = process.env.OPS_ORIGIN ?? 'https://ops.blox.market';
const DEALER_EMAIL = process.env.DEALER_EMAIL ?? 'dealer@drivemarket.local';
const SUPER_EMAIL = process.env.SUPER_EMAIL ?? 'super@drivemarket.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const DEFAULT_OFFER_ID = 'seed-al-jazeera-offer';

/** @type {Record<string, string>} */
const VEHICLE_IMAGE_FILES = {
  'Chery|Tiggo 7 Pro': 'chery-tiggo-7-pro-black-2026-qs387750.webp',
  'Chery|Tiggo 8 Pro': 'chery-tiggo-8-pro-white-2026-qs462557.webp',
  'Chery|Omoda 5': 'chery-tiggo-7-silver-2026-qs509580.webp',
  'Chery|Arrizo 8': 'chery-arrizo-8-standard-gray-2026-qs387742.webp',
  'Toyota|Camry': 'audi-a5-sedan.webp',
  'Nissan|Patrol': 'audi-q7-250-kw.webp',
  'Hyundai|Tucson': 'audi-q5-suv.webp',
  'Kia|Sportage': 'audi-q5-sportback.webp',
  'MG|HS': 'vehicle-70-mg-zs-white.png',
  'Chery|Tiggo 4 Pro': 'vehicle-67-chery-tiggo4-blue.png',
};

/** @type {Array<Record<string, unknown>>} */
const VEHICLES = [
  {
    make: 'Chery',
    model: 'Tiggo 7 Pro',
    trim: 'Luxury',
    modelYear: 2025,
    condition: 'new',
    price: 89000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'fwd',
    color: 'Pearl White',
    mileage: 0,
    description: 'Showroom demo — Chery Tiggo 7 Pro, ready for walk-in financing.',
  },
  {
    make: 'Chery',
    model: 'Tiggo 8 Pro',
    trim: 'Executive',
    modelYear: 2025,
    condition: 'new',
    price: 109000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'awd',
    color: 'Midnight Black',
    mileage: 0,
    description: '7-seat SUV with premium trim — ideal for family buyers.',
  },
  {
    make: 'Chery',
    model: 'Omoda 5',
    trim: 'Comfort',
    modelYear: 2024,
    condition: 'used',
    price: 72000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'fwd',
    color: 'Silver',
    mileage: 15000,
    description: 'Low-mileage pre-owned crossover in excellent condition.',
  },
  {
    make: 'Chery',
    model: 'Arrizo 8',
    trim: 'Premium',
    modelYear: 2025,
    condition: 'new',
    price: 95000,
    transmission: 'automatic',
    bodyType: 'sedan',
    drivetrain: 'fwd',
    color: 'Graphite Grey',
    mileage: 0,
    description: 'Executive sedan with full warranty.',
  },
  {
    make: 'Toyota',
    model: 'Camry',
    trim: 'SE',
    modelYear: 2023,
    condition: 'used',
    price: 115000,
    transmission: 'automatic',
    bodyType: 'sedan',
    drivetrain: 'fwd',
    color: 'White',
    mileage: 28000,
    description: 'Certified pre-owned Camry — reliable daily driver.',
  },
  {
    make: 'Nissan',
    model: 'Patrol',
    trim: 'Platinum',
    modelYear: 2022,
    condition: 'used',
    price: 245000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'four_wd',
    color: 'Sand Beige',
    mileage: 45000,
    description: 'Full-size 4WD SUV — showroom trade-in.',
  },
  {
    make: 'Hyundai',
    model: 'Tucson',
    trim: 'Smart',
    modelYear: 2024,
    condition: 'used',
    price: 98000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'fwd',
    color: 'Blue',
    mileage: 12000,
    description: 'Nearly new compact SUV with remaining factory warranty.',
  },
  {
    make: 'Kia',
    model: 'Sportage',
    trim: 'GT-Line',
    modelYear: 2025,
    condition: 'new',
    price: 102000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'awd',
    color: 'Runway Red',
    mileage: 0,
    description: 'Latest Sportage GT-Line — in stock for immediate delivery.',
  },
  {
    make: 'MG',
    model: 'HS',
    trim: 'Excite',
    modelYear: 2024,
    condition: 'used',
    price: 78000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'fwd',
    color: 'Dynamo Red',
    mileage: 8500,
    description: 'Low-km MG HS — great value used SUV.',
  },
  {
    make: 'Chery',
    model: 'Tiggo 4 Pro',
    trim: 'Standard',
    modelYear: 2025,
    condition: 'new',
    price: 69000,
    transmission: 'automatic',
    bodyType: 'suv',
    drivetrain: 'fwd',
    color: 'Ocean Blue',
    mileage: 0,
    description: 'Entry-level new SUV — popular walk-in choice.',
  },
];

/** Extra gallery shots uploaded after the cover image. */
/** @type {Record<string, string[]>} */
const GALLERY_FILES = {
  'Chery|Tiggo 7 Pro': ['chery-tiggo-7-pro-max-gray-2026-qs365017.webp'],
  'Chery|Tiggo 8 Pro': ['chery-tiggo-8-pro-max-silver-2026-qs379168.webp'],
  'Chery|Omoda 5': ['chery-tiggo-7-gray-2026-qs509583.webp'],
  'Toyota|Camry': ['audi-a6.webp'],
  'Nissan|Patrol': ['vehicle-1-vw-teramont-grey.png'],
  'Hyundai|Tucson': ['vehicle-72-hyundai-accent-silver.png'],
  'Kia|Sportage': ['audi-q3-sportback.webp'],
  'MG|HS': ['vehicle-71-mg-zs-red.png'],
  'Chery|Tiggo 4 Pro': ['vehicle-65-chery-tiggo4-white.png'],
};

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();
  constructor(origin) {
    this.origin = origin;
  }
  async request(pathname, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('Origin', this.origin);
    const cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.set('Cookie', cookie);
    const res = await fetch(`${BASE}${pathname}`, { ...init, headers });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq >= 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return res;
  }
}

async function signIn(session, email) {
  const res = await session.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email} (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

async function resolveImageFile(fileName) {
  const dirs = [
    path.resolve(__dirname, '../../marketplace/public/vehicles'),
    path.resolve(__dirname, '../assets/qauto-catalog'),
  ];
  for (const dir of dirs) {
    const filePath = path.join(dir, fileName);
    try {
      await access(filePath);
      return filePath;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Image not found: ${fileName}`);
}

async function uploadImageFile(session, productId, fileName) {
  const filePath = await resolveImageFile(fileName);
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), path.basename(filePath));
  const res = await session.request(`/api/v1/dealer/inventory/${productId}/images`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload ${fileName} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

async function main() {
  console.log(`Refresh dealer showroom images → ${BASE}\n`);

  const dealer = new Session(DEALER_ORIGIN);
  const superSession = new Session(OPS_ORIGIN);
  await signIn(dealer, DEALER_EMAIL);
  await signIn(superSession, SUPER_EMAIL);

  const inv = await dealer.request('/api/v1/dealer/inventory?limit=100').then((r) => r.json());
  const items = inv.items ?? [];
  console.log(`Existing inventory: ${items.length} item(s)\n`);

  for (const item of items) {
    const id = item.id;
    const label = `${item.make} ${item.model}`;
    const delRes = await superSession.request(`/api/v1/ops/products/${id}`, { method: 'DELETE' });
    if (delRes.status === 400) {
      const body = await delRes.text();
      if (body.includes('product_has_applications')) {
        console.warn(`Keep ${label} (${id}) — has applications`);
        continue;
      }
      throw new Error(`Delete ${id} failed (${delRes.status}): ${body.slice(0, 300)}`);
    }
    if (!delRes.ok && delRes.status !== 404) {
      throw new Error(`Delete ${id} failed (${delRes.status}): ${(await delRes.text()).slice(0, 300)}`);
    }
    console.log(`Deleted ${label} (${id})`);
  }

  console.log('\nRe-creating listings with catalog images...\n');

  /** @type {Array<{ id: string; make: string; model: string; cover: string }>} */
  const created = [];

  for (const vehicle of VEHICLES) {
    const key = `${vehicle.make}|${vehicle.model}`;
    const coverFile = VEHICLE_IMAGE_FILES[key];
    if (!coverFile) throw new Error(`No cover image mapped for ${key}`);

    const createRes = await dealer.request('/api/v1/dealer/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...vehicle,
        financeEligible: true,
        defaultOfferId: DEFAULT_OFFER_ID,
      }),
    });
    const createText = await createRes.text();
    if (!createRes.ok) {
      throw new Error(`Create ${key} failed (${createRes.status}): ${createText.slice(0, 400)}`);
    }
    const row = JSON.parse(createText);
    const id = row.id;

    await uploadImageFile(dealer, id, coverFile);
    for (const extra of GALLERY_FILES[key] ?? []) {
      await uploadImageFile(dealer, id, extra);
    }

    const pubRes = await dealer.request(`/api/v1/dealer/inventory/${id}/publish`, { method: 'POST' });
    if (!pubRes.ok) {
      throw new Error(`Publish ${id} failed (${pubRes.status}): ${(await pubRes.text()).slice(0, 400)}`);
    }

    const detail = await dealer.request(`/api/v1/dealer/inventory/${id}`).then((r) => r.json());
    const primary =
      detail.primary_image ??
      detail.images?.[0]?.storage_path ??
      detail.images?.[0]?.storagePath ??
      '(none)';
    console.log(`✓ ${vehicle.make} ${vehicle.model}`);
    console.log(`  id: ${id}`);
    console.log(`  cover: ${primary}\n`);
    created.push({ id, make: vehicle.make, model: vehicle.model, cover: primary });
  }

  console.log('Done —', created.length, 'vehicles with images.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
