"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_PROVIDER_BRANCH = exports.DEFAULT_LENDER_OF_RECORD_CODE = exports.DEFAULT_LENDER_CODE = void 0;
exports.seedFinancePartners = seedFinancePartners;
const client_1 = require("@prisma/client");
exports.DEFAULT_LENDER_CODE = 'al-jazeera';
exports.DEFAULT_LENDER_OF_RECORD_CODE = 'blox-finance';
exports.SAMPLE_PROVIDER_BRANCH = {
    code: 'HQ',
    name: 'Head Office',
    city: 'Doha',
};
async function seedFinancePartners(prisma) {
    const partners = [
        {
            code: exports.DEFAULT_LENDER_CODE,
            name: 'Al Jazeera Finance',
            crmAdapter: 'zoho',
            engagementMode: client_1.FinancePartnerEngagementMode.credit_file_handoff,
            breOwnership: client_1.BreOwnership.blox_plus_partner_bre,
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
            crmAdapter: 'none',
            engagementMode: client_1.FinancePartnerEngagementMode.full_los_underwriting,
            breOwnership: client_1.BreOwnership.blox_bre_only,
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
                isDefault: p.code === exports.DEFAULT_LENDER_CODE,
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
    const currentDefault = await prisma.financePartner.findFirst({ where: { isDefaultLender: true } });
    const lenderOfRecord = results.find((r) => r.partner.code === exports.DEFAULT_LENDER_OF_RECORD_CODE)?.partner ?? results[0]?.partner;
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
    let providerBranches = 0;
    const branchOwner = currentDefault ?? lenderOfRecord;
    if (branchOwner) {
        await prisma.financePartnerBranch.upsert({
            where: { partnerId_code: { partnerId: branchOwner.id, code: exports.SAMPLE_PROVIDER_BRANCH.code } },
            create: { partnerId: branchOwner.id, ...exports.SAMPLE_PROVIDER_BRANCH },
            update: { name: exports.SAMPLE_PROVIDER_BRANCH.name, city: exports.SAMPLE_PROVIDER_BRANCH.city, active: true },
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
//# sourceMappingURL=seed-finance-partners.js.map