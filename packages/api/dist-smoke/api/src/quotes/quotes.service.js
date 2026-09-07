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
var QuotesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const pagination_dto_1 = require("../common/pagination.dto");
const app_config_service_1 = require("../config/app-config.service");
const mail_service_1 = require("../mail/mail.service");
const guarded_transitions_1 = require("../applications/guarded-transitions");
const quote_pricing_1 = require("./quote-pricing");
const quote_response_dto_1 = require("./quote-response.dto");
function quoteStatus(quote) {
    if (quote.revokedAt)
        return 'revoked';
    if (quote.usedAt)
        return 'used';
    if (quote.expiredAt || quote.expiresAt.getTime() <= Date.now())
        return 'expired';
    return 'active';
}
let QuotesService = QuotesService_1 = class QuotesService {
    prisma;
    appConfig;
    mail;
    logger = new common_1.Logger(QuotesService_1.name);
    constructor(prisma, appConfig, mail) {
        this.prisma = prisma;
        this.appConfig = appConfig;
        this.mail = mail;
    }
    async expirePastQuotes() {
        const now = new Date();
        const result = await this.prisma.dealerQuote.updateMany({
            where: {
                expiresAt: { lte: now },
                expiredAt: null,
                usedAt: null,
                revokedAt: null,
            },
            data: { expiredAt: now },
        });
        if (result.count > 0) {
            this.logger.log(`Marked ${result.count} dealer quote(s) expired`);
        }
        return { expired: result.count };
    }
    marketplaceUrl(token) {
        return this.appConfig.marketplacePath(`/quotes/${token}`);
    }
    assertDealer(user) {
        if (user.role !== client_1.UserRole.dealer_agent || !user.companyId) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    async create(user, dto) {
        this.assertDealer(user);
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
            include: {
                defaultOffer: true,
                company: { select: { name: true } },
            },
        });
        if (!product || product.companyId !== user.companyId) {
            throw new common_1.NotFoundException('listing_not_available');
        }
        if (product.listingStatus !== client_1.ListingStatus.published || !product.financeEligible) {
            throw new common_1.BadRequestException('listing_not_available');
        }
        const negotiatedPrice = Number(dto.negotiatedPrice);
        const listPrice = Number(product.price);
        if (!Number.isFinite(negotiatedPrice) || negotiatedPrice <= 0) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (negotiatedPrice > listPrice) {
            throw new common_1.BadRequestException('negotiated_price_exceeds_list');
        }
        const expiresAt = new Date(dto.expiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const email = (0, quote_pricing_1.normalizeEmail)(dto.customerEmail);
        if (!email || !email.includes('@')) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const offer = product.defaultOffer ??
            (await this.prisma.offer.findFirst({
                where: { isDefault: true, status: 'active' },
            }));
        if (!offer)
            throw new common_1.BadRequestException('validation_failed');
        const token = (0, node_crypto_1.randomBytes)(24).toString('base64url');
        const quote = await this.prisma.dealerQuote.create({
            data: {
                token,
                productId: product.id,
                companyId: product.companyId,
                createdByUserId: user.id,
                customerEmail: email,
                listPriceSnapshot: listPrice,
                negotiatedPrice,
                offerId: offer.id,
                expiresAt,
            },
            include: {
                product: { select: { make: true, model: true, modelYear: true, slug: true } },
            },
        });
        const quoteUrl = this.marketplaceUrl(quote.token);
        const vehicleLabel = [quote.product.make, quote.product.model, quote.product.modelYear]
            .filter(Boolean)
            .join(' ');
        const dealerName = product.company.name;
        void this.mail
            .sendDealerQuoteEmail({
            to: email,
            url: quoteUrl,
            dealerName,
            vehicleLabel,
            negotiatedPrice,
            expiresAt,
        })
            .catch((err) => {
            this.logger.warn(`Quote email failed quote=${quote.id} to=${email}: ${err instanceof Error ? err.message : err}`);
        });
        return (0, quote_response_dto_1.toDealerQuoteDto)({
            id: quote.id,
            token: quote.token,
            url: quoteUrl,
            customerEmail: quote.customerEmail,
            negotiatedPrice: quote.negotiatedPrice,
            listPriceSnapshot: quote.listPriceSnapshot,
            expiresAt: quote.expiresAt.toISOString(),
            status: quoteStatus(quote),
            product: quote.product,
        });
    }
    async listForDealer(user, query = {}) {
        this.assertDealer(user);
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { companyId: user.companyId };
        const [rows, total] = await Promise.all([
            this.prisma.dealerQuote.findMany({
                where,
                include: {
                    product: { select: { make: true, model: true, modelYear: true, slug: true } },
                    createdBy: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.dealerQuote.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(rows.map((q) => (0, quote_response_dto_1.toDealerQuoteListItemDto)({
            id: q.id,
            token: q.token,
            url: this.marketplaceUrl(q.token),
            customerEmail: q.customerEmail,
            negotiatedPrice: q.negotiatedPrice,
            listPriceSnapshot: q.listPriceSnapshot,
            expiresAt: q.expiresAt.toISOString(),
            usedAt: q.usedAt?.toISOString() ?? null,
            revokedAt: q.revokedAt?.toISOString() ?? null,
            createdAt: q.createdAt.toISOString(),
            status: quoteStatus(q),
            product: q.product,
            createdBy: q.createdBy,
        })), total, limit, offset);
    }
    async revoke(user, id) {
        this.assertDealer(user);
        const quote = await this.prisma.dealerQuote.findUnique({ where: { id } });
        if (!quote || quote.companyId !== user.companyId) {
            throw new common_1.NotFoundException();
        }
        if (quote.usedAt)
            throw new common_1.BadRequestException('quote_already_used');
        if (quote.revokedAt)
            return (0, quote_response_dto_1.toQuoteRevokeDto)({ id: quote.id, status: 'revoked' });
        const revoked = await this.prisma.dealerQuote.updateMany({
            where: {
                id,
                companyId: user.companyId,
                usedAt: null,
                revokedAt: null,
            },
            data: { revokedAt: new Date() },
        });
        if (revoked.count === 0) {
            const fresh = await this.prisma.dealerQuote.findUnique({ where: { id } });
            if (fresh?.revokedAt)
                return (0, quote_response_dto_1.toQuoteRevokeDto)({ id: fresh.id, status: 'revoked' });
            if (fresh?.usedAt)
                throw new common_1.BadRequestException('quote_already_used');
            (0, guarded_transitions_1.assertRowsUpdated)(0, 'stale_transition');
        }
        return (0, quote_response_dto_1.toQuoteRevokeDto)({ id: quote.id, status: 'revoked' });
    }
    async resolveByToken(token, viewer) {
        const quote = await this.prisma.dealerQuote.findUnique({
            where: { token },
            include: {
                product: {
                    include: {
                        company: { select: { id: true, name: true, code: true, logoUrl: true } },
                        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                    },
                },
                offer: true,
            },
        });
        if (!quote) {
            return { gate: 'notFound' };
        }
        const gate = (0, quote_pricing_1.resolveQuoteGate)(quote, viewer);
        const product = quote.product;
        return (0, quote_response_dto_1.toPublicQuoteResolveDto)({
            gate,
            token: quote.token,
            expiresAt: quote.expiresAt.toISOString(),
            customerEmailMasked: maskEmail(quote.customerEmail),
            product: {
                id: product.id,
                slug: product.slug,
                make: product.make,
                model: product.model,
                trim: product.trim,
                modelYear: product.modelYear,
                condition: product.condition,
                mileage: product.mileage,
                color: product.color,
                publicListPrice: Number(product.price),
                financeEligible: product.financeEligible,
                listingStatus: product.listingStatus,
                imagePath: product.images[0]?.storagePath ?? null,
            },
            company: {
                id: product.company.id,
                name: product.company.name,
                code: product.company.code,
                logoUrl: product.company.logoUrl,
            },
            ...(gate === 'active'
                ? {
                    negotiatedPrice: Number(quote.negotiatedPrice),
                    listPriceSnapshot: Number(quote.listPriceSnapshot),
                    offer: {
                        id: quote.offer.id,
                        name: quote.offer.name,
                        annualRentRate: quote.offer.annualRentRate,
                        tenureOptions: quote.offer.tenureOptions,
                        minDownPaymentPct: quote.offer.minDownPaymentPct,
                    },
                }
                : {}),
        });
    }
};
exports.QuotesService = QuotesService;
exports.QuotesService = QuotesService = QuotesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfigService,
        mail_service_1.MailService])
], QuotesService);
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain)
        return '***';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
}
//# sourceMappingURL=quotes.service.js.map