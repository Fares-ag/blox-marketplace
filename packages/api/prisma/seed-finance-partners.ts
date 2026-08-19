import type { PrismaClient } from '@prisma/client';

/**
 * Idempotent seed for finance partners + default offers (production-safe).
 */
export async function seedFinancePartners(prisma: PrismaClient) {
  const partners = [
    {
      code: 'al-jazeera',
      name: 'Al Jazeera Finance',
      crmAdapter: 'zoho' as const,
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
        isDefault: p.code === 'al-jazeera',
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

  return { seeded: results.length, partners: results.map((r) => r.partner.code) };
}
