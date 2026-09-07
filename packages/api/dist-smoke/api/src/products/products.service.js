"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const slugify_1 = __importDefault(require("slugify"));
const pricing_1 = require("@drivemarket/shared/pricing");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const pagination_dto_1 = require("../common/pagination.dto");
const storage_service_1 = require("../storage/storage.service");
const quote_pricing_1 = require("../quotes/quote-pricing");
const product_offer_1 = require("./product-offer");
const dealer_inventory_dto_1 = require("./dealer-inventory.dto");
const vehicle_identity_1 = require("./vehicle-identity");
let ProductsService = class ProductsService {
    static { ProductsService_1 = this; }
    prisma;
    activity;
    storage;
    constructor(prisma, activity, storage) {
        this.prisma = prisma;
        this.activity = activity;
        this.storage = storage;
    }
    async listPublished(query) {
        const where = {
            listingStatus: client_1.ListingStatus.published,
            company: { status: 'active' },
            ...(query.make ? { make: { equals: query.make, mode: 'insensitive' } } : {}),
            ...(query.model ? { model: { equals: query.model, mode: 'insensitive' } } : {}),
            ...(query.yearMin || query.yearMax
                ? {
                    modelYear: {
                        ...(query.yearMin ? { gte: query.yearMin } : {}),
                        ...(query.yearMax ? { lte: query.yearMax } : {}),
                    },
                }
                : {}),
            ...(query.priceMin || query.priceMax
                ? {
                    price: {
                        ...(query.priceMin ? { gte: query.priceMin } : {}),
                        ...(query.priceMax ? { lte: query.priceMax } : {}),
                    },
                }
                : {}),
            ...(query.condition ? { condition: query.condition } : {}),
            ...(query.companyId ? { companyId: query.companyId } : {}),
            ...(query.transmission ? { transmission: query.transmission } : {}),
            ...(query.drivetrain ? { drivetrain: query.drivetrain } : {}),
            ...(query.bodyType ? { bodyType: query.bodyType } : {}),
            ...(query.cylinders ? { cylinders: query.cylinders } : {}),
            ...(query.mileageMax != null ? { mileage: { lte: query.mileageMax } } : {}),
            ...(query.hasWarranty ? { warrantyMonths: { gt: 0 } } : {}),
            ...(query.q
                ? {
                    OR: [
                        { make: { contains: query.q, mode: 'insensitive' } },
                        { model: { contains: query.q, mode: 'insensitive' } },
                        { trim: { contains: query.q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)({ limit: query.limit, offset: query.offset }, { defaultLimit: 24, maxLimit: 100 });
        const orderBy = (() => {
            switch (query.sort) {
                case 'price_asc':
                    return [{ price: 'asc' }];
                case 'price_desc':
                    return [{ price: 'desc' }];
                case 'year_desc':
                    return [{ modelYear: 'desc' }];
                case 'mileage_asc':
                    return [{ mileage: { sort: 'asc', nulls: 'last' } }];
                case 'newest':
                default:
                    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
            }
        })();
        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include: {
                    company: { select: { id: true, name: true, code: true, logoUrl: true } },
                    images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                    defaultOffer: true,
                },
                orderBy,
                take: limit,
                skip: offset,
            }),
            this.prisma.product.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((p) => this.toPublicCard(p)), total, limit, offset);
    }
    estimateMonthlyFromOffer(price, offer) {
        if (!offer)
            return null;
        const tenureOptions = (0, quote_pricing_1.parseTenureOptions)(offer.tenureOptions);
        const tenure = tenureOptions.includes(36)
            ? 36
            : (tenureOptions[Math.floor(tenureOptions.length / 2)] ?? tenureOptions[0] ?? 36);
        const downPct = Number(offer.minDownPaymentPct);
        const downPayment = (0, pricing_1.roundMoney)((price * downPct) / 100);
        return (0, pricing_1.estimateMonthlyPayment)({
            price,
            downPayment,
            annualRatePercent: Number(offer.annualRentRate),
            tenureMonths: tenure,
        });
    }
    static FACET_ROW_CAP = 2_000;
    async listFacetOptions() {
        const rows = await this.prisma.product.findMany({
            where: {
                listingStatus: client_1.ListingStatus.published,
                company: { status: 'active' },
            },
            select: { make: true, model: true },
            distinct: ['make', 'model'],
            orderBy: [{ make: 'asc' }, { model: 'asc' }],
            take: ProductsService_1.FACET_ROW_CAP,
        });
        const makes = [...new Set(rows.map((r) => r.make))].sort((a, b) => a.localeCompare(b));
        const modelsByMake = {};
        for (const row of rows) {
            const key = row.make;
            if (!modelsByMake[key])
                modelsByMake[key] = [];
            if (!modelsByMake[key].includes(row.model)) {
                modelsByMake[key].push(row.model);
            }
        }
        for (const make of Object.keys(modelsByMake)) {
            modelsByMake[make].sort((a, b) => a.localeCompare(b));
        }
        return { makes, models_by_make: modelsByMake };
    }
    async getBySlug(slug, viewer) {
        const product = await this.prisma.product.findUnique({
            where: { slug },
            include: {
                company: { select: { id: true, name: true, code: true, logoUrl: true, contactPhone: true } },
                images: { orderBy: { sortOrder: 'asc' } },
                defaultOffer: true,
            },
        });
        if (!product)
            throw new common_1.NotFoundException('listing_not_available');
        const isOps = viewer &&
            ['admin', 'super_admin', 'credit_officer', 'finance_officer'].includes(viewer.role);
        const isDealer = viewer?.role === client_1.UserRole.dealer_agent && viewer.companyId === product.companyId;
        let isApplicant = false;
        if (viewer && product.listingStatus === client_1.ListingStatus.reserved) {
            const app = await this.prisma.application.findFirst({
                where: {
                    productId: product.id,
                    customerUserId: viewer.id,
                    status: {
                        notIn: ['rejected', 'submission_cancelled', 'completed'],
                    },
                },
            });
            isApplicant = !!app;
        }
        if (product.listingStatus === client_1.ListingStatus.published || isOps || isDealer || isApplicant) {
            const offer = product.defaultOffer ??
                (await this.prisma.offer.findFirst({
                    where: { isDefault: true, status: 'active' },
                }));
            return {
                available: true,
                availability: product.listingStatus === client_1.ListingStatus.reserved ? 'pending_financing' : 'available',
                product: this.toPublicDetail(product),
                images: product.images.map((i) => ({
                    id: i.id,
                    storage_path: i.storagePath,
                    sort_order: i.sortOrder,
                    alt_text: i.altText,
                })),
                company: {
                    id: product.company.id,
                    name: product.company.name,
                    code: product.company.code,
                    logo_url: product.company.logoUrl,
                    contact_phone: product.company.contactPhone,
                },
                offer: offer
                    ? {
                        id: offer.id,
                        name: offer.name,
                        annual_rent_rate: Number(offer.annualRentRate),
                        tenure_options: offer.tenureOptions,
                        min_down_payment_pct: Number(offer.minDownPaymentPct),
                    }
                    : null,
            };
        }
        return { available: false, reason: 'listing_not_available' };
    }
    async listDealerInventory(user, query = {}) {
        if (user.role !== client_1.UserRole.dealer_agent || !user.companyId) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { companyId: user.companyId };
        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.product.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, dealer_inventory_dto_1.toDealerInventoryDto)(item)), total, limit, offset);
    }
    async getDealerOne(user, id) {
        const product = await this.requireDealerProduct(user, id);
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(product);
    }
    async create(user, dto) {
        let companyId;
        if (user.role === client_1.UserRole.dealer_agent) {
            if (!user.companyId)
                throw new common_1.ForbiddenException('forbidden_role');
            const dealerCompany = await this.prisma.company.findUnique({ where: { id: user.companyId } });
            if (dealerCompany?.kind === 'holding')
                throw new common_1.BadRequestException('holding_cannot_have_products');
            companyId = user.companyId;
        }
        else if (user.role === client_1.UserRole.admin || user.role === client_1.UserRole.super_admin) {
            if (!dto.companyId)
                throw new common_1.BadRequestException('company_required');
            const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
            if (!company)
                throw new common_1.BadRequestException('company_not_found');
            if (company.kind === 'holding')
                throw new common_1.BadRequestException('holding_cannot_have_products');
            companyId = dto.companyId;
        }
        else {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const id = (0, node_crypto_1.randomUUID)();
        const slug = this.buildSlug(dto, id);
        if (dto.defaultOfferId) {
            await (0, product_offer_1.assertDefaultOfferForCompany)(this.prisma, companyId, dto.defaultOfferId);
        }
        const identity = (0, vehicle_identity_1.resolveVehicleIdentityInput)(dto);
        const created = await this.prisma.product.create({
            data: {
                id,
                companyId,
                slug,
                make: dto.make,
                model: dto.model,
                trim: dto.trim,
                modelYear: dto.modelYear,
                condition: dto.condition ?? client_1.VehicleCondition.used,
                engine: dto.engine,
                transmission: dto.transmission,
                cylinders: dto.cylinders,
                drivetrain: dto.drivetrain,
                bodyType: dto.bodyType,
                warrantyMonths: dto.warrantyMonths,
                warrantyNotes: dto.warrantyNotes,
                color: dto.color,
                mileage: dto.mileage,
                vin: identity.vin ?? null,
                chassisNumber: identity.chassisNumber ?? null,
                engineNumber: identity.engineNumber ?? null,
                description: dto.description,
                price: dto.price,
                financeEligible: dto.financeEligible ?? true,
                defaultOfferId: dto.defaultOfferId,
                listingStatus: client_1.ListingStatus.draft,
            },
        });
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(created);
    }
    async update(user, id, dto) {
        const product = await this.requireDealerProduct(user, id);
        if (dto.defaultOfferId) {
            await (0, product_offer_1.assertDefaultOfferForCompany)(this.prisma, product.companyId, dto.defaultOfferId);
        }
        const identity = (0, vehicle_identity_1.resolveVehicleIdentityInput)(dto);
        const updated = await this.prisma.product.update({
            where: { id: product.id },
            data: {
                make: dto.make,
                model: dto.model,
                trim: dto.trim,
                modelYear: dto.modelYear,
                condition: dto.condition,
                engine: dto.engine,
                transmission: dto.transmission,
                cylinders: dto.cylinders,
                drivetrain: dto.drivetrain,
                bodyType: dto.bodyType,
                warrantyMonths: dto.warrantyMonths,
                warrantyNotes: dto.warrantyNotes,
                color: dto.color,
                mileage: dto.mileage,
                vin: identity.vin,
                chassisNumber: identity.chassisNumber,
                engineNumber: identity.engineNumber,
                description: dto.description,
                price: dto.price,
                financeEligible: dto.financeEligible,
                defaultOfferId: dto.defaultOfferId,
            },
        });
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(updated);
    }
    async addImage(user, productId, file) {
        const product = await this.requireDealerProduct(user, productId);
        this.storage.assertImage(file);
        const url = await this.storage.uploadListingImage(file, product.companyId, product.id);
        const count = await this.prisma.productImage.count({ where: { productId } });
        const image = await this.prisma.productImage.create({
            data: {
                productId,
                storagePath: url,
                sortOrder: count,
                altText: `${product.make} ${product.model}`,
            },
        });
        return (0, dealer_inventory_dto_1.toDealerProductImageDto)(image);
    }
    async publish(user, productId) {
        const product = await this.requireDealerProduct(user, productId);
        if (!product.price || Number(product.price) <= 0 || !product.make || !product.model) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (!product.transmission) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (product.condition === client_1.VehicleCondition.used && product.mileage == null) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const images = await this.prisma.productImage.count({ where: { productId } });
        if (images < 1)
            throw new common_1.BadRequestException('validation_failed');
        const company = await this.prisma.company.findUnique({ where: { id: product.companyId } });
        if (!company || company.status !== 'active') {
            throw new common_1.BadRequestException('validation_failed');
        }
        const updated = await this.prisma.product.update({
            where: { id: productId },
            data: {
                listingStatus: client_1.ListingStatus.published,
                publishedAt: product.publishedAt ?? new Date(),
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'product',
            entityId: productId,
            action: 'publish',
            fromValue: product.listingStatus,
            toValue: 'published',
        });
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(updated);
    }
    async unpublish(user, productId) {
        const product = await this.requireDealerProduct(user, productId);
        const blocking = await this.prisma.application.findFirst({
            where: {
                productId,
                status: { notIn: ['rejected', 'submission_cancelled', 'completed'] },
            },
        });
        if (blocking)
            throw new common_1.BadRequestException('listing_has_active_financing');
        const updated = await this.prisma.product.update({
            where: { id: productId },
            data: { listingStatus: client_1.ListingStatus.draft },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'product',
            entityId: productId,
            action: 'unpublish',
            fromValue: product.listingStatus,
            toValue: 'draft',
        });
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(updated);
    }
    buildSlug(dto, id) {
        const parts = [
            dto.make,
            dto.model,
            dto.trim,
            String(dto.modelYear),
            dto.color,
            dto.transmission,
            dto.bodyType,
            id.slice(0, 8),
        ].filter(Boolean);
        return (0, slugify_1.default)(parts.join('-'), { lower: true, strict: true });
    }
    async getOpsOne(user, id) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                company: { select: { id: true, name: true, code: true } },
                images: { orderBy: { sortOrder: 'asc' } },
                defaultOffer: { select: { id: true, name: true } },
            },
        });
        if (!product)
            throw new common_1.NotFoundException('listing_not_available');
        return {
            ...(0, dealer_inventory_dto_1.toDealerInventoryDto)(product),
            company_name: product.company.name,
            company_code: product.company.code,
            default_offer_name: product.defaultOffer?.name ?? null,
        };
    }
    async updateOps(user, id, dto) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('listing_not_available');
        const listingStatus = dto.listingStatus &&
            ['draft', 'published', 'reserved', 'sold', 'archived'].includes(dto.listingStatus)
            ? dto.listingStatus
            : undefined;
        const identity = (0, vehicle_identity_1.resolveVehicleIdentityInput)(dto);
        const updated = await this.prisma.product.update({
            where: { id },
            data: {
                ...(dto.price !== undefined ? { price: dto.price } : {}),
                ...(dto.financeEligible !== undefined ? { financeEligible: dto.financeEligible } : {}),
                ...(dto.defaultOfferId !== undefined ? { defaultOfferId: dto.defaultOfferId || null } : {}),
                ...(dto.make !== undefined ? { make: dto.make } : {}),
                ...(dto.model !== undefined ? { model: dto.model } : {}),
                ...(dto.description !== undefined ? { description: dto.description } : {}),
                ...(identity.vin !== undefined ? { vin: identity.vin } : {}),
                ...(identity.chassisNumber !== undefined ? { chassisNumber: identity.chassisNumber } : {}),
                ...(identity.engineNumber !== undefined ? { engineNumber: identity.engineNumber } : {}),
                ...(listingStatus ? { listingStatus } : {}),
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'product',
            entityId: id,
            action: 'ops_product_updated',
        });
        return (0, dealer_inventory_dto_1.toDealerInventoryDto)(updated);
    }
    async deleteOps(user, id) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const apps = await this.prisma.application.count({ where: { productId: id } });
        if (apps > 0)
            throw new common_1.BadRequestException('product_has_applications');
        await this.prisma.product.delete({ where: { id } });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'product',
            entityId: id,
            action: 'product_deleted',
        });
        return { ok: true };
    }
    async bulkStatus(user, ids, listingStatus) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        if (!['draft', 'published', 'archived'].includes(listingStatus)) {
            throw new common_1.BadRequestException('invalid_listing_status');
        }
        const result = await this.prisma.product.updateMany({
            where: { id: { in: ids } },
            data: { listingStatus: listingStatus },
        });
        return { updated: result.count };
    }
    async requireDealerProduct(user, id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('listing_not_available');
        const ok = user.role === client_1.UserRole.admin ||
            user.role === client_1.UserRole.super_admin ||
            (user.role === client_1.UserRole.dealer_agent && user.companyId === product.companyId);
        if (!ok)
            throw new common_1.ForbiddenException('forbidden_role');
        return product;
    }
    toPublicCard(p) {
        const price = Number(p.price);
        return {
            id: p.id,
            slug: p.slug,
            make: p.make,
            model: p.model,
            trim: p.trim,
            model_year: p.modelYear,
            condition: p.condition,
            transmission: p.transmission,
            cylinders: p.cylinders,
            drivetrain: p.drivetrain,
            body_type: p.bodyType,
            color: p.color,
            mileage: p.mileage,
            description: p.description,
            price,
            finance_eligible: p.financeEligible,
            warranty_months: p.warrantyMonths,
            warranty_notes: p.warrantyNotes,
            attributes: Array.isArray(p.attributes) ? p.attributes : [],
            company_id: p.companyId,
            company_name: p.company.name,
            company_code: p.company.code,
            company_logo: p.company.logoUrl,
            primary_image: p.images[0]?.storagePath ?? null,
            published_at: p.publishedAt,
            est_monthly: p.financeEligible && p.defaultOffer
                ? this.estimateMonthlyFromOffer(price, p.defaultOffer)
                : null,
        };
    }
    toPublicDetail(p) {
        const card = this.toPublicCard(p);
        return {
            ...card,
            engine: p.engine,
            listing_status: p.listingStatus,
            default_offer_id: p.defaultOfferId,
        };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        storage_service_1.StorageService])
], ProductsService);
//# sourceMappingURL=products.service.js.map