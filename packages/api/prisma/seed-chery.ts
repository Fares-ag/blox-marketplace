import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BodyType,
  Drivetrain,
  type PrismaClient,
  Transmission,
  VehicleCondition,
} from '@prisma/client';

export type CheryListing = {
  id: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  color?: string;
  price: number;
  gear?: string;
  drive?: string;
  body?: string;
  cover?: string;
  uri?: string;
  condition?: string;
  mileage?: number;
};

export const DEFAULT_OFFER_ID = 'seed-blox-finance-offer';

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
    path.join(process.cwd(), 'prisma/chery-elite-motors-import.json'),
    path.join(process.cwd(), 'scripts/chery-elite-motors-import.json'),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('chery-elite-motors-import.json not found in prisma/ or scripts/');
}

export function loadCheryListings(): CheryListing[] {
  const jsonPath = resolveImportPath();
  const raw = readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as CheryListing[];
}

/** Idempotent Chery Elite Motors inventory seed (production-safe). */
export async function seedCheryInventory(prisma: PrismaClient) {
  const company = await prisma.company.upsert({
    where: { code: 'chery-elite-motors' },
    create: {
      name: 'Chery Elite Motors',
      code: 'chery-elite-motors',
      status: 'active',
      allowDirectActivate: true,
    },
    update: {
      name: 'Chery Elite Motors',
      status: 'active',
    },
  });

  const listings = loadCheryListings();
  let count = 0;

  for (const item of listings) {
    const slug = item.uri ?? item.id;
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        companyId: company.id,
        slug,
        make: item.make,
        model: item.model,
        trim: item.trim ?? null,
        modelYear: item.year,
        color: item.color ?? null,
        mileage: item.mileage ?? (mapCondition(item.condition) === VehicleCondition.new ? 0 : null),
        price: item.price,
        transmission: mapTransmission(item.gear),
        drivetrain: mapDrivetrain(item.drive),
        bodyType: mapBodyType(item.body),
        condition: mapCondition(item.condition),
        financeEligible: true,
        defaultOfferId: DEFAULT_OFFER_ID,
        listingStatus: 'published',
        publishedAt: new Date(),
      },
      update: {
        make: item.make,
        model: item.model,
        trim: item.trim ?? null,
        modelYear: item.year,
        color: item.color ?? null,
        price: item.price,
        transmission: mapTransmission(item.gear),
        drivetrain: mapDrivetrain(item.drive),
        bodyType: mapBodyType(item.body),
        condition: mapCondition(item.condition),
        defaultOfferId: DEFAULT_OFFER_ID,
        listingStatus: 'published',
        publishedAt: new Date(),
      },
    });

    if (item.cover) {
      const existing = await prisma.productImage.findFirst({
        where: { productId: product.id, sortOrder: 0 },
      });
      if (existing) {
        await prisma.productImage.update({
          where: { id: existing.id },
          data: { storagePath: item.cover, altText: `${item.make} ${item.model}` },
        });
      } else {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            storagePath: item.cover,
            sortOrder: 0,
            altText: `${item.make} ${item.model}`,
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
