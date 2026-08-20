import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, User, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { assertRowsUpdated } from '../applications/guarded-transitions';
import { normalizeEmail, resolveQuoteGate } from './quote-pricing';

function quoteStatus(quote: {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  expiredAt?: Date | null;
}): 'active' | 'used' | 'expired' | 'revoked' {
  if (quote.revokedAt) return 'revoked';
  if (quote.usedAt) return 'used';
  if (quote.expiredAt || quote.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'active';
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Persists expiry for quotes past expiresAt. Safe to run repeatedly;
   * redemption still checks computed expiry as a fallback.
   */
  async expirePastQuotes(): Promise<{ expired: number }> {
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

  private marketplaceUrl(token: string): string {
    const base =
      this.config.get<string>('MARKETPLACE_URL') ??
      this.config.get<string>('VITE_MARKETPLACE_URL') ??
      'http://localhost:5173';
    return `${base.replace(/\/$/, '')}/quotes/${token}`;
  }

  private assertDealer(user: User) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  async create(
    user: User,
    dto: {
      productId: string;
      customerEmail: string;
      negotiatedPrice: number;
      expiresAt: string;
    },
  ) {
    this.assertDealer(user);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { defaultOffer: true },
    });
    if (!product || product.companyId !== user.companyId) {
      throw new NotFoundException('listing_not_available');
    }
    if (product.listingStatus !== ListingStatus.published || !product.financeEligible) {
      throw new BadRequestException('listing_not_available');
    }

    const negotiatedPrice = Number(dto.negotiatedPrice);
    const listPrice = Number(product.price);
    if (!Number.isFinite(negotiatedPrice) || negotiatedPrice <= 0) {
      throw new BadRequestException('validation_failed');
    }
    if (negotiatedPrice > listPrice) {
      throw new BadRequestException('negotiated_price_exceeds_list');
    }

    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('validation_failed');
    }

    const email = normalizeEmail(dto.customerEmail);
    if (!email || !email.includes('@')) {
      throw new BadRequestException('validation_failed');
    }

    const offer =
      product.defaultOffer ??
      (await this.prisma.offer.findFirst({
        where: { isDefault: true, status: 'active' },
      }));
    if (!offer) throw new BadRequestException('validation_failed');

    const token = randomBytes(24).toString('base64url');
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

    return {
      id: quote.id,
      token: quote.token,
      url: this.marketplaceUrl(quote.token),
      customerEmail: quote.customerEmail,
      negotiatedPrice: Number(quote.negotiatedPrice),
      listPriceSnapshot: Number(quote.listPriceSnapshot),
      expiresAt: quote.expiresAt.toISOString(),
      status: quoteStatus(quote),
      product: quote.product,
    };
  }

  async listForDealer(user: User, query: { limit?: number; offset?: number } = {}) {
    this.assertDealer(user);
    const take = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const skip = Math.max(query.offset ?? 0, 0);
    const where = { companyId: user.companyId! };
    const [rows, total] = await Promise.all([
      this.prisma.dealerQuote.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.dealerQuote.count({ where }),
    ]);

    return {
      total,
      items: rows.map((q) => ({
        id: q.id,
        token: q.token,
        url: this.marketplaceUrl(q.token),
        customerEmail: q.customerEmail,
        negotiatedPrice: Number(q.negotiatedPrice),
        listPriceSnapshot: Number(q.listPriceSnapshot),
        expiresAt: q.expiresAt.toISOString(),
        usedAt: q.usedAt?.toISOString() ?? null,
        revokedAt: q.revokedAt?.toISOString() ?? null,
        createdAt: q.createdAt.toISOString(),
        status: quoteStatus(q),
        product: q.product,
        createdBy: q.createdBy,
      })),
    };
  }

  async revoke(user: User, id: string) {
    this.assertDealer(user);
    const quote = await this.prisma.dealerQuote.findUnique({ where: { id } });
    if (!quote || quote.companyId !== user.companyId) {
      throw new NotFoundException();
    }
    if (quote.usedAt) throw new BadRequestException('quote_already_used');
    if (quote.revokedAt) return { id: quote.id, status: 'revoked' as const };

    const revoked = await this.prisma.dealerQuote.updateMany({
      where: {
        id,
        companyId: user.companyId!,
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      const fresh = await this.prisma.dealerQuote.findUnique({ where: { id } });
      if (fresh?.revokedAt) return { id: fresh.id, status: 'revoked' as const };
      if (fresh?.usedAt) throw new BadRequestException('quote_already_used');
      assertRowsUpdated(0, 'stale_transition');
    }
    return { id: quote.id, status: 'revoked' as const };
  }

  async resolveByToken(token: string, viewer?: User | null) {
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
      return { gate: 'notFound' as const };
    }

    const gate = resolveQuoteGate(quote, viewer);
    const product = quote.product;
    const base = {
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
    };

    if (gate !== 'active') {
      return base;
    }

    return {
      ...base,
      negotiatedPrice: Number(quote.negotiatedPrice),
      listPriceSnapshot: Number(quote.listPriceSnapshot),
      offer: {
        id: quote.offer.id,
        name: quote.offer.name,
        annual_rent_rate: Number(quote.offer.annualRentRate),
        tenure_options: quote.offer.tenureOptions,
        min_down_payment_pct: Number(quote.offer.minDownPaymentPct),
      },
    };
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
