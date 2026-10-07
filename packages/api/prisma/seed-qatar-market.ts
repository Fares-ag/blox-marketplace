import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BodyType,
  Drivetrain,
  type PrismaClient,
  Transmission,
  VehicleCondition,
} from '@prisma/client';
import { DEFAULT_OFFER_ID } from './seed-chery';

export type QatarMarketListing = {
  id: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  condition?: string;
  engine?: string;
  color?: string;
  mileage?: number;
  price: number;
  gear?: string;
  drive?: string;
  body?: string;
  image?: string;
  description?: string;
};

export const EXPECTED_QATAR_MARKET_COUNT = 24;

/** Authorized Qatar importer for each make in this catalog (not Chery Elite Motors). */
export const QATAR_MARKET_DEALERS = [
  { code: 'al-abdulghani-motors', name: 'Al Abdulghani Motors', makes: ['Toyota', 'Lexus'] },
  { code: 'saleh-al-hamad-al-mana', name: 'Saleh Al Hamad Al Mana', makes: ['Nissan'] },
  { code: 'skyline-automotive', name: 'Skyline Automotive', makes: ['Hyundai'] },
  { code: 'al-attiya-motors', name: 'Al-Attiya Motors', makes: ['Kia'] },
  { code: 'domasco', name: 'DOMASCO', makes: ['Honda'] },
  { code: 'qatar-automobiles-company', name: 'Qatar Automobiles Company', makes: ['Mitsubishi'] },
  { code: 'mannai-autos', name: 'Mannai Autos', makes: ['GMC'] },
  { code: 'jaidah-automotive', name: 'Jaidah Automotive', makes: ['Chevrolet'] },
  { code: 'almana-motors', name: 'Almana Motors', makes: ['Ford'] },
  { code: 'nasser-bin-khaled-automobiles', name: 'Nasser Bin Khaled Automobiles', makes: ['Mercedes-Benz'] },
  { code: 'alfardan-automobiles', name: 'Alfardan Automobiles', makes: ['BMW'] },
  { code: 'alfardan-premier-motors', name: 'Alfardan Premier Motors', makes: ['Land Rover', 'Range Rover'] },
] as const;

export const QATAR_MARKET_DEALER_CODES = QATAR_MARKET_DEALERS.map((d) => d.code);

export function dealerForMake(make: string) {
  const dealer = QATAR_MARKET_DEALERS.find((d) => (d.makes as readonly string[]).includes(make));
  if (!dealer) {
    throw new Error(`No authorized Qatar dealer mapped for make: ${make}`);
  }
  return dealer;
}

/** Makes already owned by QAuto or Chery Elite Motors — this catalog must not overlap them. */
export const QATAR_MARKET_EXCLUDED_MAKES = ['Audi', 'Volkswagen', 'Skoda', 'Chery'] as const;

function mapTransmission(gear?: string): Transmission {
  return gear?.toLowerCase() === 'manual' ? Transmission.manual : Transmission.automatic;
}

function mapDrivetrain(drive?: string): Drivetrain {
  const d = (drive ?? '').toUpperCase();
  if (d.includes('4WD') || d.includes('FOUR')) return Drivetrain.four_wd;
  if (d.includes('AWD')) return Drivetrain.awd;
  if (d.includes('RWD')) return Drivetrain.rwd;
  return Drivetrain.fwd;
}

function mapBodyType(body?: string): BodyType {
  const b = (body ?? '').toLowerCase();
  if (b.includes('suv')) return BodyType.suv;
  if (b.includes('pick')) return BodyType.pickup;
  if (b.includes('sedan')) return BodyType.sedan;
  if (b.includes('coupe')) return BodyType.coupe;
  if (b.includes('hatch')) return BodyType.hatchback;
  if (b.includes('van')) return BodyType.van;
  return BodyType.other;
}

function mapCondition(condition?: string): VehicleCondition {
  return condition?.toLowerCase() === 'used' ? VehicleCondition.used : VehicleCondition.new;
}

function resolveImportPath(): string {
  const candidates = [
    path.join(process.cwd(), 'prisma/qatar-market-import.json'),
    path.join(process.cwd(), 'scripts/qatar-market-import.json'),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('qatar-market-import.json not found in prisma/ or scripts/');
}

export function loadQatarMarketListings(): QatarMarketListing[] {
  const jsonPath = resolveImportPath();
  const raw = readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as { listings?: QatarMarketListing[] };
  if (!Array.isArray(parsed.listings) || parsed.listings.length === 0) {
    throw new Error('qatar-market-import.json has no listings array');
  }
  return parsed.listings;
}

async function upsertQatarMarketDealer(
  prisma: PrismaClient,
  spec: { code: string; name: string },
) {
  return prisma.company.upsert({
    where: { code: spec.code },
    create: {
      name: spec.name,
      code: spec.code,
      status: 'active',
      allowDirectActivate: true,
    },
    update: {
      name: spec.name,
      status: 'active',
    },
  });
}

/** Idempotent Qatar catalog: each make sits on its authorized dealer. */
export async function seedQatarMarketInventory(prisma: PrismaClient) {
  const listings = loadQatarMarketListings();
  if (listings.length !== EXPECTED_QATAR_MARKET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_QATAR_MARKET_COUNT} Qatar-market listings, got ${listings.length}`,
    );
  }

  const companies = new Map<string, Awaited<ReturnType<typeof upsertQatarMarketDealer>>>();
  const publishedByCode = new Map<string, number>();
  for (const spec of QATAR_MARKET_DEALERS) {
    const company = await upsertQatarMarketDealer(prisma, spec);
    companies.set(spec.code, company);
    publishedByCode.set(spec.code, 0);
  }

  const seenIds = new Set<string>();
  let count = 0;

  for (const item of listings) {
    if (seenIds.has(item.id)) {
      throw new Error(`Duplicate listing id in Qatar-market import: ${item.id}`);
    }
    seenIds.add(item.id);
    if ((QATAR_MARKET_EXCLUDED_MAKES as readonly string[]).includes(item.make)) {
      throw new Error(`Qatar-market catalog must not include ${item.make}`);
    }

    const dealer = dealerForMake(item.make);
    const company = companies.get(dealer.code);
    if (!company) {
      throw new Error(`Missing company for dealer ${dealer.code}`);
    }

    const condition = mapCondition(item.condition);
    const product = await prisma.product.upsert({
      where: { slug: item.id },
      create: {
        companyId: company.id,
        slug: item.id,
        make: item.make,
        model: item.model,
        trim: item.trim ?? null,
        modelYear: item.year,
        condition,
        engine: item.engine ?? null,
        color: item.color ?? null,
        mileage: item.mileage ?? (condition === VehicleCondition.new ? 0 : null),
        description: item.description ?? null,
        price: item.price,
        transmission: mapTransmission(item.gear),
        drivetrain: mapDrivetrain(item.drive),
        bodyType: mapBodyType(item.body),
        financeEligible: true,
        defaultOfferId: DEFAULT_OFFER_ID,
        listingStatus: 'published',
        publishedAt: new Date(),
      },
      update: {
        companyId: company.id,
        make: item.make,
        model: item.model,
        trim: item.trim ?? null,
        modelYear: item.year,
        condition,
        engine: item.engine ?? null,
        color: item.color ?? null,
        mileage: item.mileage ?? (condition === VehicleCondition.new ? 0 : null),
        description: item.description ?? null,
        price: item.price,
        transmission: mapTransmission(item.gear),
        drivetrain: mapDrivetrain(item.drive),
        bodyType: mapBodyType(item.body),
        defaultOfferId: DEFAULT_OFFER_ID,
        listingStatus: 'published',
        publishedAt: new Date(),
      },
    });

    if (item.image) {
      const alt = `${item.make} ${item.model}`.trim();
      const existing = await prisma.productImage.findFirst({
        where: { productId: product.id, sortOrder: 0 },
      });
      if (existing) {
        await prisma.productImage.update({
          where: { id: existing.id },
          data: { storagePath: item.image, altText: alt },
        });
      } else {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            storagePath: item.image,
            sortOrder: 0,
            altText: alt,
          },
        });
      }
    }

    count += 1;
    publishedByCode.set(dealer.code, (publishedByCode.get(dealer.code) ?? 0) + 1);
  }

  return {
    listingsPublished: count,
    dealers: QATAR_MARKET_DEALERS.map((spec) => {
      const company = companies.get(spec.code)!;
      return {
        companyId: company.id,
        companyCode: company.code,
        companyName: company.name,
        listingsPublished: publishedByCode.get(spec.code) ?? 0,
      };
    }),
  };
}
