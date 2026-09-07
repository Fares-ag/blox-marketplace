"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPECTED_SKODA_COUNT = exports.EXPECTED_VW_COUNT = exports.EXPECTED_AUDI_COUNT = void 0;
exports.loadQautoListings = loadQautoListings;
exports.seedQautoInventory = seedQautoInventory;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("@prisma/client");
const bootstrap_qauto_1 = require("./bootstrap-qauto");
const seed_chery_1 = require("./seed-chery");
exports.EXPECTED_AUDI_COUNT = 25;
exports.EXPECTED_VW_COUNT = 32;
exports.EXPECTED_SKODA_COUNT = 34;
const COMPANY_CODE_BY_MAKE = {
    Audi: 'qauto-audi',
    Volkswagen: 'qauto-vw',
    Skoda: 'qauto-skoda',
};
function resolveImportPath() {
    const candidates = [
        node_path_1.default.join(process.cwd(), 'prisma/qauto-inventory-import.json'),
        node_path_1.default.join(process.cwd(), 'scripts/qauto-inventory-import.json'),
    ];
    for (const candidate of candidates) {
        try {
            (0, node_fs_1.readFileSync)(candidate, 'utf8');
            return candidate;
        }
        catch {
        }
    }
    throw new Error('qauto-inventory-import.json not found in prisma/ or scripts/');
}
function loadQautoListings() {
    const jsonPath = resolveImportPath();
    const raw = (0, node_fs_1.readFileSync)(jsonPath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.listings) || parsed.listings.length === 0) {
        throw new Error('qauto-inventory-import.json has no listings array');
    }
    return parsed.listings;
}
function attributeValue(attrs, key) {
    const hit = attrs.find((a) => a.id === key || a.name === key);
    const value = hit?.value?.trim();
    return value || undefined;
}
function mapBodyType(listing) {
    const body = attributeValue(listing.attributes, 'body_style')?.toLowerCase();
    if (body) {
        if (body.includes('suv'))
            return client_1.BodyType.suv;
        if (body === 'sedan')
            return client_1.BodyType.sedan;
        if (body === 'sportback' || body === 'avant')
            return client_1.BodyType.hatchback;
        if (body.includes('pick'))
            return client_1.BodyType.pickup;
        if (body.includes('van'))
            return client_1.BodyType.van;
        return client_1.BodyType.other;
    }
    const model = listing.model.toLowerCase();
    if (['teramont', 'tiguan', 't-roc', 'karoq', 'kodiaq', 'kushaq', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'sq5', 'sq8', 'rsq8'].some((m) => model.includes(m))) {
        return client_1.BodyType.suv;
    }
    if (['octavia', 'superb'].some((m) => model.includes(m))) {
        return client_1.BodyType.sedan;
    }
    if (model === 'amarok')
        return client_1.BodyType.pickup;
    if (model === 'caddy')
        return client_1.BodyType.van;
    if (['jetta', 'passat', 'a3', 'a5', 'a6', 'a8', 's3', 's8', 'rs3', 'rs5'].some((m) => model.includes(m))) {
        return client_1.BodyType.sedan;
    }
    return null;
}
function mapCondition(raw) {
    return raw.toLowerCase() === 'old' || raw.toLowerCase() === 'used'
        ? client_1.VehicleCondition.used
        : client_1.VehicleCondition.new;
}
async function ensureOffer(prisma) {
    const offer = await prisma.offer.findUnique({ where: { id: seed_chery_1.DEFAULT_OFFER_ID } });
    if (!offer) {
        throw new Error(`Default offer "${seed_chery_1.DEFAULT_OFFER_ID}" missing — run seedFinancePartners before seedQautoInventory`);
    }
    return offer;
}
async function resolveCompanies(prisma) {
    let audi = await prisma.company.findUnique({ where: { code: 'qauto-audi' } });
    let vw = await prisma.company.findUnique({ where: { code: 'qauto-vw' } });
    let skoda = await prisma.company.findUnique({ where: { code: 'qauto-skoda' } });
    if (!audi || !vw || !skoda) {
        await (0, bootstrap_qauto_1.bootstrapQauto)(prisma);
        audi = await prisma.company.findUnique({ where: { code: 'qauto-audi' } });
        vw = await prisma.company.findUnique({ where: { code: 'qauto-vw' } });
        skoda = await prisma.company.findUnique({ where: { code: 'qauto-skoda' } });
    }
    if (!audi || !vw || !skoda) {
        throw new Error('QAuto Audi/Volkswagen/Skoda companies missing after bootstrapQauto');
    }
    return { audi, vw, skoda };
}
function productData(listing, companyId) {
    const attributes = listing.attributes;
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
        defaultOfferId: seed_chery_1.DEFAULT_OFFER_ID,
        listingStatus: 'published',
        publishedAt: new Date(),
    };
}
async function upsertCoverImage(prisma, productId, listing) {
    if (!listing.image)
        return;
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
async function seedQautoInventory(prisma) {
    await ensureOffer(prisma);
    const companies = await resolveCompanies(prisma);
    const listings = loadQautoListings();
    const audiListings = listings.filter((l) => l.make === 'Audi');
    const vwListings = listings.filter((l) => l.make === 'Volkswagen');
    const skodaListings = listings.filter((l) => l.make === 'Skoda');
    if (audiListings.length !== exports.EXPECTED_AUDI_COUNT) {
        throw new Error(`Expected ${exports.EXPECTED_AUDI_COUNT} Audi listings, got ${audiListings.length}`);
    }
    if (vwListings.length !== exports.EXPECTED_VW_COUNT) {
        throw new Error(`Expected ${exports.EXPECTED_VW_COUNT} Volkswagen listings, got ${vwListings.length}`);
    }
    if (skodaListings.length !== exports.EXPECTED_SKODA_COUNT) {
        throw new Error(`Expected ${exports.EXPECTED_SKODA_COUNT} Skoda listings, got ${skodaListings.length}`);
    }
    const companyByCode = {
        'qauto-audi': companies.audi,
        'qauto-vw': companies.vw,
        'qauto-skoda': companies.skoda,
    };
    const seenIds = new Set();
    for (const listing of listings) {
        if (seenIds.has(listing.id)) {
            throw new Error(`Duplicate listing id in import: ${listing.id}`);
        }
        seenIds.add(listing.id);
        const companyCode = COMPANY_CODE_BY_MAKE[listing.make];
        if (!companyCode) {
            throw new Error(`Unsupported make in QAuto import: ${listing.make}`);
        }
        const company = companyByCode[companyCode];
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
        skodaCompanyId: companies.skoda.id,
        audiPublished: audiListings.length,
        volkswagenPublished: vwListings.length,
        skodaPublished: skodaListings.length,
        listingsPublished: listings.length,
    };
}
//# sourceMappingURL=seed-qauto-inventory.js.map