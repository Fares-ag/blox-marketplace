import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BodyType,
  type Prisma,
  type PrismaClient,
  VehicleCondition,
} from '@prisma/client';
import { bootstrapQauto } from './bootstrap-qauto';
import { DEFAULT_OFFER_ID } from './seed-chery';

export type QautoAttribute = {
  id: string;
  name: string;
  value: string;
};

export type QautoListing = {
  id: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  condition: string;
  engine: string;
  color: string;
  mileage: number;
  price: number;
  description: string;
  image: string | null;
  attributes: QautoAttribute[];
};

export const EXPECTED_AUDI_COUNT = 25;
export const EXPECTED_VW_COUNT = 32;

const COMPANY_CODE_BY_MAKE: Record<string, string> = {
  Audi: 'qauto-audi',
  Volkswagen: 'qauto-vw',
};

function resolveImportPath(): string {
  const candidates = [
    path.join(process.cwd(), 'prisma/qauto-inventory-import.json'),
    path.join(process.cwd(), 'scripts/qauto-inventory-import.json'),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('qauto-inventory-import.json not found in prisma/ or scripts/');
}

export function loadQautoListings(): QautoListing[] {
  const jsonPath = resolveImportPath();
  const raw = readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as { listings?: QautoListing[] };
  if (!Array.isArray(parsed.listings) || parsed.listings.length === 0) {
    throw new Error('qauto-inventory-import.json has no listings array');
  }
  return parsed.listings;
}

function attributeValue(attrs: QautoAttribute[], key: string): string | undefined {
  const hit = attrs.find((a) => a.id === key || a.name === key);
  const value = hit?.value?.trim();
  return value || undefined;
}

function mapBodyType(listing: QautoListing): BodyType | null {
  const body = attributeValue(listing.attributes, 'body_style')?.toLowerCase();
  if (body) {
    if (body.includes('suv')) return BodyType.suv;
    if (body === 'sedan') return BodyType.sedan;
    if (body === 'sportback' || body === 'avant') return BodyType.hatchback;
    if (body.includes('pick')) return BodyType.pickup;
    if (body.includes('van')) return BodyType.van;
    return BodyType.other;
  }

  const model = listing.model.toLowerCase();
  if (['teramont', 'tiguan', 't-roc', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'sq5', 'sq8', 'rsq8'].some((m) => model.includes(m))) {
    return BodyType.suv;
  }
  if (model === 'amarok') return BodyType.pickup;
  if (model === 'caddy') return BodyType.van;
  if (['jetta', 'passat', 'a3', 'a5', 'a6', 'a8', 's3', 's8', 'rs3', 'rs5'].some((m) => model.includes(m))) {
    return BodyType.sedan;
  }
  return null;
}

function mapCondition(raw: string): VehicleCondition {
  return raw.toLowerCase() === 'old' || raw.toLowerCase() === 'used'
    ? VehicleCondition.used
    : VehicleCondition.new;
}

async function ensureOffer(prisma: PrismaClient) {
  const offer = await prisma.offer.findUnique({ where: { id: DEFAULT_OFFER_ID } });
  if (!offer) {
    throw new Error(
      `Default offer "${DEFAULT_OFFER_ID}" missing — run seedFinancePartners before seedQautoInventory`,
    );
  }
  return offer;
}

async function resolveCompanies(prisma: PrismaClient) {
  let audi = await prisma.company.findUnique({ where: { code: 'qauto-audi' } });
  let vw = await prisma.company.findUnique({ where: { code: 'qauto-vw' } });
  if (!audi || !vw) {
    await bootstrapQauto(prisma);
    audi = await prisma.company.findUnique({ where: { code: 'qauto-audi' } });
    vw = await prisma.company.findUnique({ where: { code: 'qauto-vw' } });
  }
  if (!audi || !vw) {
    throw new Error('QAuto Audi/Volkswagen companies missing after bootstrapQauto');
  }
  return { audi, vw };
}

function productData(
  listing: QautoListing,
  companyId: string,
): Prisma.ProductUncheckedCreateInput {
  const attributes = listing.attributes as unknown as Prisma.InputJsonValue;
  return {
    id: listing.id,
    slug: listing.id,
    companyId,
    make: listing.make,
    model: listing.model,
    trim: listing.trim || null,
    modelYear: listing.year,
    condition: mapCondition(listing.condition),
    engine: listing.engine || null,
    color: listing.color || null,
    mileage: listing.mileage,
    description: listing.description || null,
    attributes,
    bodyType: mapBodyType(listing),
    price: listing.price,
    financeEligible: true,
    defaultOfferId: DEFAULT_OFFER_ID,
    listingStatus: 'published',
    publishedAt: new Date(),
  };
}

async function upsertCoverImage(
  prisma: PrismaClient,
  productId: string,
  listing: QautoListing,
) {
  if (!listing.image) return;
  const alt = `${listing.make} ${listing.model}`.trim();
  const existing = await prisma.productImage.findFirst({
    where: { productId, sortOrder: 0 },
  });
  if (existing) {
    await prisma.productImage.update({
      where: { id: existing.id },
      data: { storagePath: listing.image, altText: alt },
    });
    return;
  }
  await prisma.productImage.create({
    data: {
      productId,
      storagePath: listing.image,
      sortOrder: 0,
      altText: alt,
    },
  });
}

/** Idempotent QAuto Audi + Volkswagen inventory seed (production-safe). */
export async function seedQautoInventory(prisma: PrismaClient) {
  await ensureOffer(prisma);
  const companies = await resolveCompanies(prisma);
  const listings = loadQautoListings();

  const audiListings = listings.filter((l) => l.make === 'Audi');
  const vwListings = listings.filter((l) => l.make === 'Volkswagen');
  if (audiListings.length !== EXPECTED_AUDI_COUNT) {
    throw new Error(`Expected ${EXPECTED_AUDI_COUNT} Audi listings, got ${audiListings.length}`);
  }
  if (vwListings.length !== EXPECTED_VW_COUNT) {
    throw new Error(`Expected ${EXPECTED_VW_COUNT} Volkswagen listings, got ${vwListings.length}`);
  }

  const seenIds = new Set<string>();
  for (const listing of listings) {
    if (seenIds.has(listing.id)) {
      throw new Error(`Duplicate listing id in import: ${listing.id}`);
    }
    seenIds.add(listing.id);
    const companyCode = COMPANY_CODE_BY_MAKE[listing.make];
    if (!companyCode) {
      throw new Error(`Unsupported make in QAuto import: ${listing.make}`);
    }
    const company = companyCode === 'qauto-audi' ? companies.audi : companies.vw;
    const data = productData(listing, company.id);

    const product = await prisma.product.upsert({
      where: { slug: listing.id },
      create: data,
      update: {
        companyId: data.companyId,
        make: data.make,
        model: data.model,
        trim: data.trim,
        modelYear: data.modelYear,
        condition: data.condition,
        engine: data.engine,
        color: data.color,
        mileage: data.mileage,
        description: data.description,
        attributes: data.attributes,
        bodyType: data.bodyType,
        price: data.price,
        defaultOfferId: data.defaultOfferId,
        listingStatus: 'published',
        publishedAt: new Date(),
      },
    });

    await upsertCoverImage(prisma, product.id, listing);
  }

  return {
    audiCompanyId: companies.audi.id,
    vwCompanyId: companies.vw.id,
    audiPublished: audiListings.length,
    volkswagenPublished: vwListings.length,
    listingsPublished: listings.length,
  };
}
