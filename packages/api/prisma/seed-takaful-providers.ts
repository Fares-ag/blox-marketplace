import type { PrismaClient } from '@prisma/client';

/** Stored rider shape (`TakafulProvider.riders`): `{ code, label, labelAr, annualAmount }`. */
export type SeedTakafulRider = { code: string; label: string; labelAr: string; annualAmount: number };

export type SeedTakafulProvider = {
  code: string;
  name: string;
  nameAr: string;
  /** Comprehensive cover as % of vehicle value per year. */
  comprehensiveRatePct: number;
  thirdPartyAnnual: number;
  minContribution: number;
  riders: SeedTakafulRider[];
  contactPhone: string;
  contactEmail: string;
  website: string;
  sortOrder: number;
};

const ROADSIDE: SeedTakafulRider = {
  code: 'roadside',
  label: 'Roadside assistance',
  labelAr: 'المساعدة على الطريق',
  annualAmount: 150,
};
const AGENCY_REPAIR: SeedTakafulRider = {
  code: 'agency_repair',
  label: 'Agency repair',
  labelAr: 'الإصلاح لدى الوكالة',
  annualAmount: 400,
};
const REPLACEMENT_CAR: SeedTakafulRider = {
  code: 'replacement_car',
  label: 'Replacement car',
  labelAr: 'سيارة بديلة',
  annualAmount: 250,
};
const GCC_COVER: SeedTakafulRider = {
  code: 'gcc_cover',
  label: 'GCC cover',
  labelAr: 'تغطية دول مجلس التعاون الخليجي',
  annualAmount: 200,
};
const NATURAL_PERILS: SeedTakafulRider = {
  code: 'natural_perils',
  label: 'Natural perils',
  labelAr: 'الأخطار الطبيعية',
  annualAmount: 120,
};

/** Sample rate cards for the quote comparison (indicative figures, not tariffs). */
export const TAKAFUL_PROVIDER_SEED: SeedTakafulProvider[] = [
  {
    code: 'qic-takaful',
    name: 'QIC Takaful',
    nameAr: 'كيو آي سي تكافل',
    comprehensiveRatePct: 3.25,
    thirdPartyAnnual: 1200,
    minContribution: 1500,
    riders: [ROADSIDE, AGENCY_REPAIR, REPLACEMENT_CAR, GCC_COVER],
    contactPhone: '+974 4400 1100',
    contactEmail: 'motor@qic-takaful.example',
    website: 'https://www.qic-takaful.example',
    sortOrder: 1,
  },
  {
    code: 'doha-takaful',
    name: 'Doha Takaful',
    nameAr: 'الدوحة تكافل',
    comprehensiveRatePct: 3.0,
    thirdPartyAnnual: 1100,
    minContribution: 1400,
    riders: [ROADSIDE, AGENCY_REPAIR, NATURAL_PERILS],
    contactPhone: '+974 4400 1200',
    contactEmail: 'motor@doha-takaful.example',
    website: 'https://www.doha-takaful.example',
    sortOrder: 2,
  },
  {
    code: 'qatar-islamic-insurance',
    name: 'Qatar Islamic Insurance',
    nameAr: 'الشركة القطرية الإسلامية للتأمين',
    comprehensiveRatePct: 3.4,
    thirdPartyAnnual: 1250,
    minContribution: 1600,
    riders: [ROADSIDE, AGENCY_REPAIR, REPLACEMENT_CAR, GCC_COVER, NATURAL_PERILS],
    contactPhone: '+974 4400 1300',
    contactEmail: 'motor@qiic.example',
    website: 'https://www.qiic.example',
    sortOrder: 3,
  },
];

/**
 * Idempotent, production-safe: providers are created with their sample rate
 * card; on re-runs only the display fields are refreshed — rates, riders and
 * the active flag are master data an admin maintains from the provider page.
 */
export async function seedTakafulProviders(prisma: PrismaClient, providers = TAKAFUL_PROVIDER_SEED) {
  const codes: string[] = [];
  for (const p of providers) {
    const row = await prisma.takafulProvider.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        nameAr: p.nameAr,
        comprehensiveRatePct: p.comprehensiveRatePct,
        thirdPartyAnnual: p.thirdPartyAnnual,
        minContribution: p.minContribution,
        riders: p.riders,
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        website: p.website,
        active: true,
        sortOrder: p.sortOrder,
      },
      update: {
        name: p.name,
        nameAr: p.nameAr,
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        website: p.website,
        sortOrder: p.sortOrder,
      },
    });
    codes.push(row.code);
  }
  return { seeded: codes.length, codes };
}
