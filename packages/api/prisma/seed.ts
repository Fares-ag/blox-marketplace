import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BodyType,
  Drivetrain,
  PrismaClient,
  Transmission,
  VehicleCondition,
} from '@prisma/client';
import { seedFinancePartners } from './seed-finance-partners';

const prisma = new PrismaClient();

type CheryListing = {
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

const DEFAULT_OFFER_ID = 'seed-al-jazeera-offer';

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

async function seedCheryListings(companyId: string) {
  const jsonPath = path.join(process.cwd(), 'scripts/chery-elite-motors-import.json');
  const raw = readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const listings = JSON.parse(raw) as CheryListing[];

  let count = 0;
  for (const item of listings) {
    const slug = item.uri ?? item.id;
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        companyId,
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

  return count;
}

async function main() {
  const finance = await seedFinancePartners(prisma);
  console.log('Finance partners seeded:', finance.partners.join(', '));

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

  const productCount = await seedCheryListings(company.id);
  console.log(`Published ${productCount} Chery Elite Motors listings (${company.name}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
