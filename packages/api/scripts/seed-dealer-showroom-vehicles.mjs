/**
 * Create and publish showroom vehicles for dealer@drivemarket.local via the live API.
 *
 * Usage:
 *   API_URL=https://api.blox.market node packages/api/scripts/seed-dealer-showroom-vehicles.mjs
 */
const BASE = process.env.API_URL ?? 'https://api.blox.market';
const ORIGIN = process.env.DEALER_ORIGIN ?? 'https://dealer.blox.market';
const EMAIL = process.env.DEALER_EMAIL ?? 'dealer@drivemarket.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const DEFAULT_OFFER_ID = 'seed-al-jazeera-offer';

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function resolveVehicleImageFile(make, model) {
  const fileName = VEHICLE_IMAGE_FILES[`${make}|${model}`];
  if (!fileName) return null;
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
  return null;
}

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

class Session {
  /** @type {Map<string, string>} */
  cookies = new Map();
  constructor(origin) {
    this.origin = origin;
  }
  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('Origin', this.origin);
    const cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.set('Cookie', cookie);
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq >= 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return res;
  }
}

async function signIn(session) {
  const res = await session.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

async function uploadImage(session, productId, make, model) {
  const filePath = await resolveVehicleImageFile(make, model);
  if (!filePath) {
    throw new Error(`No catalog image for ${make} ${model}`);
  }
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
    throw new Error(`Image upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

async function main() {
  console.log(`Seeding ${VEHICLES.length} vehicles → ${BASE} as ${EMAIL}\n`);
  const session = new Session(ORIGIN);
  await signIn(session);

  const profile = await session.request('/api/v1/me').then((r) => r.json());
  const companyId = profile.company_id ?? profile.companyId;
  if (!companyId) {
    throw new Error(
      'Dealer account has no company_id. Run: railway run --service api node scripts/ensure-seed-users.mjs',
    );
  }
  console.log('Signed in — role:', profile.role, 'company_id:', companyId, '\n');

  /** @type {Array<{ id: string; make: string; model: string; status: string }>} */
  const created = [];

  for (const vehicle of VEHICLES) {
    const body = {
      ...vehicle,
      financeEligible: true,
      defaultOfferId: DEFAULT_OFFER_ID,
    };
    const createRes = await session.request('/api/v1/dealer/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const createText = await createRes.text();
    if (!createRes.ok) {
      throw new Error(`Create failed for ${vehicle.make} ${vehicle.model} (${createRes.status}): ${createText.slice(0, 400)}`);
    }
    const row = JSON.parse(createText);
    const id = row.id;
    console.log(`Created ${vehicle.make} ${vehicle.model} → ${id}`);

    await uploadImage(session, id, vehicle.make, vehicle.model);

    const pubRes = await session.request(`/api/v1/dealer/inventory/${id}/publish`, { method: 'POST' });
    const pubText = await pubRes.text();
    if (!pubRes.ok) {
      throw new Error(`Publish failed for ${id} (${pubRes.status}): ${pubText.slice(0, 400)}`);
    }
    const published = JSON.parse(pubText);
    const status = published.listing_status ?? published.listingStatus ?? 'published';
    console.log(`  Published (${status})\n`);
    created.push({ id, make: vehicle.make, model: vehicle.model, status });
  }

  const inv = await session.request('/api/v1/dealer/inventory?limit=100').then((r) => r.json());
  const publishedCount = (inv.items ?? []).filter(
    (p) => (p.listing_status ?? p.listingStatus) === 'published',
  ).length;
  console.log('Done.');
  console.log('Created & published:', created.length);
  console.log('Total published inventory:', publishedCount);
  console.log('\nVehicles:');
  for (const v of created) {
    console.log(`  - ${v.make} ${v.model} (${v.id})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
