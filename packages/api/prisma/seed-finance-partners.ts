import { BreOwnership, FinancePartnerEngagementMode, type PrismaClient } from '@prisma/client';

/** Partner whose offer is the marketplace default (existing Zoho hand-off flow). */
export const DEFAULT_LENDER_CODE = 'al-jazeera';

/**
 * Lender of record for applications whose offer carries no partner. Blox's own
 * book (`crmAdapter: none`) so Blox-financed contracts keep `financing_source:
 * 'blox'`; an admin can move the flag to another provider at any time.
 */
export const DEFAULT_LENDER_OF_RECORD_CODE = 'blox-finance';

/** Sample provider branch attached to the default lender of record. */
export const SAMPLE_PROVIDER_BRANCH = {
  code: 'HQ',
  name: 'Head Office',
  city: 'Doha',
} as const;

/**
 * Idempotent seed for finance partners + default offers (production-safe).
 * Engagement mode / BRE ownership and the default-lender flag are master data
 * an admin may change later, so they are only written when creating a partner
 * or when no default lender exists yet.
 */
export async function seedFinancePartners(prisma: PrismaClient) {
  const partners = [
    {
      code: DEFAULT_LENDER_CODE,
      name: 'Al Jazeera Finance',
      crmAdapter: 'zoho' as const,
      engagementMode: FinancePartnerEngagementMode.credit_file_handoff,
      breOwnership: BreOwnership.blox_plus_partner_bre,
      contactName: 'Al Jazeera Finance — Auto Desk',
      contactEmail: 'autofinance@aljazeerafinance.example',
      contactPhone: '+974 4400 0000',
      offer: {
        id: 'seed-al-jazeera-offer',
        name: 'Al Jazeera Standard',
        annualRentRate: 12.5,
        minDownPaymentPct: 10,
        tenureOptions: [12, 24, 36, 48, 60],
      },
    },
    {
      code: 'blox-finance',
      name: 'Blox Finance',
      crmAdapter: 'none' as const,
      engagementMode: FinancePartnerEngagementMode.full_los_underwriting,
      breOwnership: BreOwnership.blox_bre_only,
      contactName: 'Blox Finance Operations',
      contactEmail: 'finance@blox.example',
      contactPhone: '+974 4400 0001',
      offer: {
        id: 'seed-blox-finance-offer',
        name: 'Blox Standard',
        annualRentRate: 11.9,
        minDownPaymentPct: 10,
        tenureOptions: [12, 24, 36, 48, 60],
      },
    },
  ];

  const results = [];
  for (const p of partners) {
    const partner = await prisma.financePartner.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        active: true,
        crmAdapter: p.crmAdapter,
        engagementMode: p.engagementMode,
        breOwnership: p.breOwnership,
        isDefaultLender: false,
        contactName: p.contactName,
        contactEmail: p.contactEmail,
        contactPhone: p.contactPhone,
      },
      update: { name: p.name, active: true, crmAdapter: p.crmAdapter },
    });

    const offer = await prisma.offer.upsert({
      where: { id: p.offer.id },
      create: {
        id: p.offer.id,
        name: p.offer.name,
        annualRentRate: p.offer.annualRentRate,
        minDownPaymentPct: p.offer.minDownPaymentPct,
        tenureOptions: p.offer.tenureOptions,
        isDefault: p.code === DEFAULT_LENDER_CODE,
        status: 'active',
        financePartnerId: partner.id,
      },
      update: {
        name: p.offer.name,
        annualRentRate: p.offer.annualRentRate,
        minDownPaymentPct: p.offer.minDownPaymentPct,
        tenureOptions: p.offer.tenureOptions,
        financePartnerId: partner.id,
        status: 'active',
      },
    });

    results.push({ partner, offer });
  }

  await prisma.offer.updateMany({
    where: { id: 'seed-default-offer' },
    data: { financePartnerId: results[0]?.partner.id },
  }).catch(() => undefined);

  // Default lender of record: Blox's own book, unless an admin already chose one.
  const currentDefault = await prisma.financePartner.findFirst({ where: { isDefaultLender: true } });
  const lenderOfRecord =
    results.find((r) => r.partner.code === DEFAULT_LENDER_OF_RECORD_CODE)?.partner ?? results[0]?.partner;
  let defaultLender = currentDefault?.code ?? null;
  if (!currentDefault && lenderOfRecord) {
    await prisma.$transaction([
      prisma.financePartner.updateMany({
        where: { id: { not: lenderOfRecord.id } },
        data: { isDefaultLender: false },
      }),
      prisma.financePartner.update({
        where: { id: lenderOfRecord.id },
        data: { isDefaultLender: true },
      }),
    ]);
    defaultLender = lenderOfRecord.code;
  }

  // Sample provider branch on the lender of record (idempotent on partnerId + code).
  let providerBranches = 0;
  const branchOwner = currentDefault ?? lenderOfRecord;
  if (branchOwner) {
    await prisma.financePartnerBranch.upsert({
      where: { partnerId_code: { partnerId: branchOwner.id, code: SAMPLE_PROVIDER_BRANCH.code } },
      create: { partnerId: branchOwner.id, ...SAMPLE_PROVIDER_BRANCH },
      update: { name: SAMPLE_PROVIDER_BRANCH.name, city: SAMPLE_PROVIDER_BRANCH.city, active: true },
    });
    providerBranches = 1;
  }

  return {
    seeded: results.length,
    partners: results.map((r) => r.partner.code),
    defaultLender,
    providerBranches,
  };
}
