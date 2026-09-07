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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const applications_service_1 = require("../applications/applications.service");
const customer_snapshot_1 = require("../applications/customer-snapshot");
const products_service_1 = require("../products/products.service");
const customer_payments_service_1 = require("../payments/customer-payments.service");
const credits_service_1 = require("../credits/credits.service");
let MobileService = class MobileService {
    prisma;
    apps;
    products;
    customerPayments;
    credits;
    constructor(prisma, apps, products, customerPayments, credits) {
        this.prisma = prisma;
        this.apps = apps;
        this.products = products;
        this.customerPayments = customerPayments;
        this.credits = credits;
    }
    async listVehicles(query) {
        const str = (v) => {
            const first = Array.isArray(v) ? v[0] : v;
            const trimmed = first?.trim();
            return trimmed ? trimmed : undefined;
        };
        const num = (v) => {
            const s = str(v);
            if (s === undefined)
                return undefined;
            const n = Number(s);
            return Number.isFinite(n) ? n : undefined;
        };
        const condition = str(query.condition)?.toLowerCase();
        const page = await this.products.listPublished({
            make: str(query.make),
            model: str(query.model),
            q: str(query.q),
            condition: condition === 'new' || condition === 'used'
                ? condition
                : condition === 'old'
                    ? client_1.VehicleCondition.used
                    : undefined,
            priceMin: num(query.priceMin),
            priceMax: num(query.priceMax),
            yearMin: num(query.yearMin),
            yearMax: num(query.yearMax),
            limit: Math.min(Math.max(num(query.limit) ?? 25, 1), 100),
            offset: Math.max(num(query.offset) ?? 0, 0),
        });
        return {
            ...page,
            items: (page.items ?? []).map((p) => this.toVehicle(p)),
        };
    }
    async getVehicle(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { images: { orderBy: { sortOrder: 'asc' } }, defaultOffer: true, company: true },
        });
        if (!product || product.listingStatus !== client_1.ListingStatus.published) {
            throw new common_1.NotFoundException('vehicle_not_found');
        }
        return this.toVehicle({
            ...product,
            price: product.price,
            images: product.images,
        });
    }
    toVehicle(p) {
        const images = this.normalizeImages(p);
        const attributes = Array.isArray(p.attributes) ? p.attributes : [];
        return {
            id: p.id,
            vehicle_id: p.id,
            make: p.make,
            model: p.model,
            trim: p.trim ?? null,
            model_year: p.model_year ?? p.modelYear,
            condition: p.condition === 'used' ? 'old' : p.condition,
            engine: p.engine ?? null,
            color: p.color ?? null,
            mileage: p.mileage ?? null,
            price: p.price,
            status: 'active',
            description: p.description ?? null,
            attributes,
            images,
        };
    }
    normalizeImages(p) {
        const out = [];
        if (Array.isArray(p.images)) {
            for (const img of p.images) {
                const url = this.imageUrlFrom(img);
                if (url)
                    out.push(url);
            }
        }
        if (out.length === 0) {
            const primary = p.primary_image ?? p.primaryImage;
            if (typeof primary === 'string' && primary.trim()) {
                out.push(primary.trim());
            }
        }
        return out;
    }
    imageUrlFrom(img) {
        if (typeof img === 'string' && img.trim())
            return img.trim();
        if (img && typeof img === 'object') {
            const row = img;
            for (const key of ['storagePath', 'storage_path', 'url', 'src', 'path']) {
                const value = row[key];
                if (typeof value === 'string' && value.trim())
                    return value.trim();
            }
        }
        return null;
    }
    async createApplication(user, dto) {
        const product = await this.prisma.product.findUnique({
            where: { id: dto.vehicleId },
            include: { defaultOffer: true },
        });
        if (!product?.defaultOfferId)
            throw new common_1.BadRequestException('listing_not_available');
        const offer = await this.prisma.offer.findUnique({ where: { id: product.defaultOfferId } });
        if (!offer)
            throw new common_1.BadRequestException('listing_not_available');
        const listPrice = Number(product.price);
        const down = Number(dto.calculator?.downPayment ?? 0);
        const downPct = listPrice > 0 ? (down / listPrice) * 100 : Number(offer.minDownPaymentPct);
        const genderRaw = String(dto.gender ?? '').trim().toLowerCase();
        const gender = customer_snapshot_1.GENDER_VALUES.includes(genderRaw)
            ? genderRaw
            : undefined;
        const residenceDurationRaw = dto.residenceDuration ?? dto.calculator?.durationOfResidence;
        const residenceDuration = customer_snapshot_1.RESIDENCE_DURATION_VALUES.includes(String(residenceDurationRaw ?? ''))
            ? String(residenceDurationRaw)
            : undefined;
        const employmentType = dto.calculator?.employmentType?.trim() || undefined;
        const salary = Number.isFinite(Number(dto.calculator?.salary)) && dto.calculator?.salary != null
            ? Number(dto.calculator.salary)
            : undefined;
        return this.apps.create(user, {
            productId: product.id,
            offerId: offer.id,
            customerSnapshot: {
                full_name: `${dto.firstName} ${dto.lastName}`.trim(),
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                qid: dto.nationalId,
                email: dto.email,
                applicantType: 'individual',
                ...(gender ? { gender } : {}),
                ...(dto.nationality ? { nationality: dto.nationality } : {}),
                ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
                ...(residenceDuration ? { residenceDuration } : {}),
                employment: {
                    ...(employmentType ? { employmentType } : {}),
                    ...(salary !== undefined ? { salary } : {}),
                },
                ...(salary !== undefined ? { income: salary, monthlyIncome: salary } : {}),
            },
            pricingSnapshot: {
                tenor: dto.calculator?.termMonths ?? 36,
                down_payment_pct: downPct,
                down_payment: down,
                loan_amount: dto.calculator?.loanAmount,
                monthly_payment: dto.calculator?.monthlyPayment,
                annual_rental_rate: dto.calculator?.annualRentalRate,
                nationality: dto.nationality,
                gender: dto.gender,
                email: dto.email,
            },
        });
    }
    async dashboard(user) {
        const apps = await this.prisma.application.findMany({
            where: { customerUserId: user.id },
            include: {
                product: { select: { make: true, model: true, price: true } },
                paymentSchedules: { orderBy: { sequence: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const credits = await this.credits.getBalance(user);
        return {
            applications: apps.map((a) => ({
                id: a.id,
                status: a.status,
                vehicle_id: a.productId,
                vehicle: a.product,
                pricing_snapshot: a.pricingSnapshot,
                kyc_status: a.kycStatus,
                payment_schedules: a.paymentSchedules,
            })),
            credits,
        };
    }
    async offer(user, applicationId) {
        const app = await this.apps.getOne(user, applicationId);
        const pricing = app.pricing_snapshot ?? {};
        return {
            application_id: applicationId,
            status: app.status,
            pricing_snapshot: pricing,
            offer: app.offer ?? null,
        };
    }
    async acceptOffer(user, applicationId) {
        const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.NotFoundException();
        if (app.status === 'draft') {
            return this.apps.submit(user, applicationId);
        }
        return { ok: true, status: app.status };
    }
    async preDisbursal(user, applicationId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            include: { documents: true },
        });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.NotFoundException();
        const qidVerified = app.documents.some((d) => d.category === 'qid' && d.verificationStatus === 'verified');
        return {
            application_id: applicationId,
            status: app.status,
            kyc_status: app.kycStatus,
            qid_verified: qidVerified,
            contract_generated: app.contractGenerated,
            signed_contract: Boolean(app.signedContractPath),
        };
    }
    async completePreDisbursal(user, applicationId) {
        return this.preDisbursal(user, applicationId);
    }
    async paymentsHub(user) {
        return this.customerPayments.paymentsHub(user);
    }
    async registerDeviceToken(user, input) {
        await this.prisma.deviceToken.upsert({
            where: { fcmToken: input.fcmToken },
            update: { userId: user.id, platform: input.platform, appVersion: input.appVersion },
            create: {
                userId: user.id,
                platform: input.platform,
                fcmToken: input.fcmToken,
                appVersion: input.appVersion,
            },
        });
        return { ok: true };
    }
    async listMineFlattened(user) {
        const page = await this.apps.listMine(user, { limit: 50, offset: 0 });
        return page;
    }
};
exports.MobileService = MobileService;
exports.MobileService = MobileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        applications_service_1.ApplicationsService,
        products_service_1.ProductsService,
        customer_payments_service_1.CustomerPaymentsService,
        credits_service_1.CreditsService])
], MobileService);
//# sourceMappingURL=mobile.service.js.map