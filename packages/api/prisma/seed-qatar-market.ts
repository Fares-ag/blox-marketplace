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

/** Same dealership as `dealer@drivemarket.local` (Chery Elite Motors showroom). */
export const QATAR_MARKET_DEALER_CODE = 'chery-elite-motors';
export const QATAR_MARKET_DEALER_NAME = 'Chery Elite Motors';
export const EXPECTED_QATAR_MARKET_COUNT = 24;

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

async function resolveQatarMarketDealer(prisma: PrismaClient) {
  const company = await prisma.company.findUnique({
    where: { code: QATAR_MARKET_DEALER_CODE },
  });
  if (!company) {
    throw new Error(
      `${QATAR_MARKET_DEALER_NAME} (${QATAR_MARKET_DEALER_CODE}) must exist before seeding Qatar-market inventory — run seedCheryInventory first or ensure-seed-users.`,
    );
  }
  return company;
}

/** Idempotent multi-brand Qatar catalog under Chery Elite Motors (production-safe). */
export async function seedQatarMarketInventory(prisma: PrismaClient) {
  const company = await resolveQatarMarketDealer(prisma);

  const listings = loadQatarMarketListings();
  if (listings.length !== EXPECTED_QATAR_MARKET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_QATAR_MARKET_COUNT} Qatar-market listings, got ${listings.length}`,
    );
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
  }

  return {
    companyId: company.id,
    companyCode: company.code,
    companyName: company.name,
    listingsPublished: count,
  };
}
