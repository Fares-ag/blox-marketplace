import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  Prisma,
  User,
  UserRole,
  VehicleCondition,
} from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  async listPublished(query: {
    make?: string;
    model?: string;
    yearMin?: number;
    yearMax?: number;
    priceMin?: number;
    priceMax?: number;
    condition?: VehicleCondition;
    companyId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      listingStatus: ListingStatus.published,
      company: { status: 'active' },
      ...(query.make ? { make: { equals: query.make, mode: 'insensitive' } } : {}),
      ...(query.model ? { model: { contains: query.model, mode: 'insensitive' } } : {}),
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

    const take = Math.min(Math.max(query.limit ?? 24, 1), 100);
    const skip = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      total,
      items: items.map((p) => this.toPublicCard(p)),
    };
  }

  async getBySlug(slug: string, viewer?: User | null) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        defaultOffer: true,
      },
    });
    if (!product) throw new NotFoundException('listing_not_available');

    const isOps =
      viewer &&
      ['admin', 'super_admin', 'credit_officer', 'finance_officer'].includes(viewer.role);
    const isDealer =
      viewer?.role === UserRole.dealer_agent && viewer.companyId === product.companyId;

    let isApplicant = false;
    if (viewer && product.listingStatus === ListingStatus.reserved) {
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

    if (product.listingStatus === ListingStatus.published || isOps || isDealer || isApplicant) {
      const offer =
        product.defaultOffer ??
        (await this.prisma.offer.findFirst({
          where: { isDefault: true, status: 'active' },
        }));

      return {
        available: true,
        availability:
          product.listingStatus === ListingStatus.reserved ? 'pending_financing' : 'available',
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
          logo_url: product.company.logoUrl,
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

  async listDealerInventory(user: User) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
    return this.prisma.product.findMany({
      where: { companyId: user.companyId },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(user: User, dto: {
    make: string;
    model: string;
    trim?: string;
    modelYear: number;
    condition?: VehicleCondition;
    engine?: string;
    color?: string;
    mileage?: number;
    vin?: string;
    description?: string;
    price: number;
    financeEligible?: boolean;
    defaultOfferId?: string;
  }) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
        throw new ForbiddenException('forbidden_role');
      }
    }
    const companyId = user.companyId!;
    const id = randomUUID();
    const slugBase = slugify(`${dto.make}-${dto.model}-${dto.modelYear}-${id.slice(0, 8)}`, {
      lower: true,
      strict: true,
    });

    return this.prisma.product.create({
      data: {
        id,
        companyId,
        slug: slugBase,
        make: dto.make,
        model: dto.model,
        trim: dto.trim,
        modelYear: dto.modelYear,
        condition: dto.condition ?? VehicleCondition.used,
        engine: dto.engine,
        color: dto.color,
        mileage: dto.mileage,
        vin: dto.vin,
        description: dto.description,
        price: dto.price,
        financeEligible: dto.financeEligible ?? true,
        defaultOfferId: dto.defaultOfferId,
        listingStatus: ListingStatus.draft,
      },
    });
  }

  async update(
    user: User,
    id: string,
    dto: {
      make?: string;
      model?: string;
      trim?: string;
      modelYear?: number;
      condition?: VehicleCondition;
      engine?: string;
      color?: string;
      mileage?: number;
      vin?: string;
      description?: string;
      price?: number;
      financeEligible?: boolean;
      defaultOfferId?: string;
    },
  ) {
    const product = await this.requireDealerProduct(user, id);
    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        make: dto.make,
        model: dto.model,
        trim: dto.trim,
        modelYear: dto.modelYear,
        condition: dto.condition,
        engine: dto.engine,
        color: dto.color,
        mileage: dto.mileage,
        vin: dto.vin,
        description: dto.description,
        price: dto.price,
        financeEligible: dto.financeEligible,
        defaultOfferId: dto.defaultOfferId,
      },
    });
  }

  async addImage(user: User, productId: string, file: Express.Multer.File) {
    const product = await this.requireDealerProduct(user, productId);
    this.storage.assertImage(file);
    const url = await this.storage.uploadListingImage(file, product.companyId, product.id);
    const count = await this.prisma.productImage.count({ where: { productId } });
    return this.prisma.productImage.create({
      data: {
        productId,
        storagePath: url,
        sortOrder: count,
        altText: `${product.make} ${product.model}`,
      },
    });
  }

  async publish(user: User, productId: string) {
    const product = await this.requireDealerProduct(user, productId);
    if (!product.price || Number(product.price) <= 0 || !product.make || !product.model) {
      throw new BadRequestException('validation_failed');
    }
    const images = await this.prisma.productImage.count({ where: { productId } });
    if (images < 1) throw new BadRequestException('validation_failed');

    const company = await this.prisma.company.findUnique({ where: { id: product.companyId } });
    if (!company || company.status !== 'active') {
      throw new BadRequestException('validation_failed');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        listingStatus: ListingStatus.published,
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
    return updated;
  }

  async unpublish(user: User, productId: string) {
    const product = await this.requireDealerProduct(user, productId);
    const blocking = await this.prisma.application.findFirst({
      where: {
        productId,
        status: { notIn: ['rejected', 'submission_cancelled', 'completed'] },
      },
    });
    if (blocking) throw new BadRequestException('listing_has_active_financing');

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { listingStatus: ListingStatus.draft },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'product',
      entityId: productId,
      action: 'unpublish',
      fromValue: product.listingStatus,
      toValue: 'draft',
    });
    return updated;
  }

  private async requireDealerProduct(user: User, id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('listing_not_available');
    const ok =
      user.role === UserRole.admin ||
      user.role === UserRole.super_admin ||
      (user.role === UserRole.dealer_agent && user.companyId === product.companyId);
    if (!ok) throw new ForbiddenException('forbidden_role');
    return product;
  }

  private toPublicCard(p: {
    id: string;
    slug: string;
    make: string;
    model: string;
    trim: string | null;
    modelYear: number;
    condition: VehicleCondition;
    color: string | null;
    mileage: number | null;
    description: string | null;
    price: Prisma.Decimal;
    financeEligible: boolean;
    companyId: string;
    publishedAt: Date | null;
    company: { id: string; name: string; logoUrl: string | null };
    images: { storagePath: string }[];
  }) {
    return {
      id: p.id,
      slug: p.slug,
      make: p.make,
      model: p.model,
      trim: p.trim,
      model_year: p.modelYear,
      condition: p.condition,
      color: p.color,
      mileage: p.mileage,
      description: p.description,
      price: Number(p.price),
      finance_eligible: p.financeEligible,
      company_id: p.companyId,
      company_name: p.company.name,
      company_logo: p.company.logoUrl,
      primary_image: p.images[0]?.storagePath ?? null,
      published_at: p.publishedAt,
    };
  }

  private toPublicDetail(p: {
    id: string;
    slug: string;
    make: string;
    model: string;
    trim: string | null;
    modelYear: number;
    condition: VehicleCondition;
    engine: string | null;
    color: string | null;
    mileage: number | null;
    description: string | null;
    price: Prisma.Decimal;
    financeEligible: boolean;
    listingStatus: ListingStatus;
    defaultOfferId: string | null;
  }) {
    return {
      id: p.id,
      slug: p.slug,
      make: p.make,
      model: p.model,
      trim: p.trim,
      model_year: p.modelYear,
      condition: p.condition,
      engine: p.engine,
      color: p.color,
      mileage: p.mileage,
      description: p.description,
      price: Number(p.price),
      finance_eligible: p.financeEligible,
      listing_status: p.listingStatus,
      default_offer_id: p.defaultOfferId,
      // vin omitted
    };
  }
}
