"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OFFER_ID = void 0;
exports.loadCheryListings = loadCheryListings;
exports.seedCheryInventory = seedCheryInventory;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("@prisma/client");
exports.DEFAULT_OFFER_ID = 'seed-al-jazeera-offer';
function mapTransmission(gear) {
    return gear?.toLowerCase() === 'manual' ? client_1.Transmission.manual : client_1.Transmission.automatic;
}
function mapDrivetrain(drive) {
    const d = (drive ?? '').toUpperCase();
    if (d.includes('4WD') || d.includes('FOUR'))
        return client_1.Drivetrain.four_wd;
    if (d.includes('AWD'))
        return client_1.Drivetrain.awd;
    if (d.includes('RWD'))
        return client_1.Drivetrain.rwd;
    return client_1.Drivetrain.fwd;
}
function mapBodyType(body) {
    const b = (body ?? '').toLowerCase();
    if (b.includes('suv'))
        return client_1.BodyType.suv;
    if (b.includes('pick'))
        return client_1.BodyType.pickup;
    if (b.includes('sedan'))
        return client_1.BodyType.sedan;
    if (b.includes('coupe'))
        return client_1.BodyType.coupe;
    if (b.includes('hatch'))
        return client_1.BodyType.hatchback;
    if (b.includes('van'))
        return client_1.BodyType.van;
    return client_1.BodyType.other;
}
function mapCondition(condition) {
    return condition?.toLowerCase() === 'used' ? client_1.VehicleCondition.used : client_1.VehicleCondition.new;
}
function resolveImportPath() {
    const candidates = [
        node_path_1.default.join(process.cwd(), 'prisma/chery-elite-motors-import.json'),
        node_path_1.default.join(process.cwd(), 'scripts/chery-elite-motors-import.json'),
    ];
    for (const candidate of candidates) {
        try {
            (0, node_fs_1.readFileSync)(candidate, 'utf8');
            return candidate;
        }
        catch {
        }
    }
    throw new Error('chery-elite-motors-import.json not found in prisma/ or scripts/');
}
function loadCheryListings() {
    const jsonPath = resolveImportPath();
    const raw = (0, node_fs_1.readFileSync)(jsonPath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
}
async function seedCheryInventory(prisma) {
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
                mileage: item.mileage ?? (mapCondition(item.condition) === client_1.VehicleCondition.new ? 0 : null),
                price: item.price,
                transmission: mapTransmission(item.gear),
                drivetrain: mapDrivetrain(item.drive),
                bodyType: mapBodyType(item.body),
                condition: mapCondition(item.condition),
                financeEligible: true,
                defaultOfferId: exports.DEFAULT_OFFER_ID,
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
                defaultOfferId: exports.DEFAULT_OFFER_ID,
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
            }
            else {
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
//# sourceMappingURL=seed-chery.js.map