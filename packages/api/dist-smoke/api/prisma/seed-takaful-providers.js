"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAKAFUL_PROVIDER_SEED = void 0;
exports.seedTakafulProviders = seedTakafulProviders;
const ROADSIDE = {
    code: 'roadside',
    label: 'Roadside assistance',
    labelAr: 'المساعدة على الطريق',
    annualAmount: 150,
};
const AGENCY_REPAIR = {
    code: 'agency_repair',
    label: 'Agency repair',
    labelAr: 'الإصلاح لدى الوكالة',
    annualAmount: 400,
};
const REPLACEMENT_CAR = {
    code: 'replacement_car',
    label: 'Replacement car',
    labelAr: 'سيارة بديلة',
    annualAmount: 250,
};
const GCC_COVER = {
    code: 'gcc_cover',
    label: 'GCC cover',
    labelAr: 'تغطية دول مجلس التعاون الخليجي',
    annualAmount: 200,
};
const NATURAL_PERILS = {
    code: 'natural_perils',
    label: 'Natural perils',
    labelAr: 'الأخطار الطبيعية',
    annualAmount: 120,
};
exports.TAKAFUL_PROVIDER_SEED = [
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
async function seedTakafulProviders(prisma, providers = exports.TAKAFUL_PROVIDER_SEED) {
    const codes = [];
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
//# sourceMappingURL=seed-takaful-providers.js.map