import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BodyType,
  Drivetrain,
  ListingStatus,
  Prisma,
  Transmission,
  User,
  UserRole,
  VehicleCondition,
} from '@prisma/client';
import slugify from 'slugify';
import { estimateMonthlyPayment, roundMoney } from '@drivemarket/shared/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { StorageService } from '../storage/storage.service';
import { parseTenureOptions } from '../quotes/quote-pricing';
import { assertDefaultOfferForCompany } from './product-offer';
import {
  toDealerInventoryDto,
  toDealerProductImageDto,
} from './dealer-inventory.dto';
import { resolveVehicleIdentityInput, type VehicleIdentityInput } from './vehicle-identity';

export type ProductInputDto = {
  companyId?: string;
  make: string;
  model: string;
  trim?: string;
  modelYear: number;
  condition?: VehicleCondition;
  engine?: string;
  transmission?: Transmission;
  cylinders?: number;
  drivetrain?: Drivetrain;
  bodyType?: BodyType;
  warrantyMonths?: number;
  warrantyNotes?: string;
  color?: string;
  mileage?: number;
  description?: string;
  price: number;
  financeEligible?: boolean;
  defaultOfferId?: string;
} & VehicleIdentityInput;

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
    transmission?: Transmission;
    drivetrain?: Drivetrain;
    bodyType?: BodyType;
    cylinders?: number;
    mileageMax?: number;
    hasWarranty?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
    sort?: 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';
  }) {
    const where: Prisma.ProductWhereInput = {
      listingStatus: ListingStatus.published,
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

    const { limit, offset } = resolvePagination(
      { limit: query.limit, offset: query.offset },
      { defaultLimit: 24, maxLimit: 100 },
    );

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
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

    return toPaginatedResponse(
      items.map((p) => this.toPublicCard(p)),
      total,
      limit,
      offset,
    );
  }

  private estimateMonthlyFromOffer(
    price: number,
    offer: {
      annualRentRate: Prisma.Decimal;
      minDownPaymentPct: Prisma.Decimal;
      tenureOptions: Prisma.JsonValue;
    } | null,
  ): number | null {
    if (!offer) return null;
    const tenureOptions = parseTenureOptions(offer.tenureOptions);
    const tenure = tenureOptions.includes(36)
      ? 36
      : (tenureOptions[Math.floor(tenureOptions.length / 2)] ?? tenureOptions[0] ?? 36);
    const downPct = Number(offer.minDownPaymentPct);
    const downPayment = roundMoney((price * downPct) / 100);
    return estimateMonthlyPayment({
      price,
      downPayment,
      annualRatePercent: Number(offer.annualRentRate),
      tenureMonths: tenure,
    });
  }

  /** Caps distinct make/model pairs returned for marketplace filter facets. */
  private static readonly FACET_ROW_CAP = 2_000;

  async listFacetOptions() {
    const rows = await this.prisma.product.findMany({
      where: {
        listingStatus: ListingStatus.published,
        company: { status: 'active' },
      },
      select: { make: true, model: true },
      distinct: ['make', 'model'],
      orderBy: [{ make: 'asc' }, { model: 'asc' }],
      take: ProductsService.FACET_ROW_CAP,
    });

    const makes = [...new Set(rows.map((r) => r.make))].sort((a, b) => a.localeCompare(b));
    const modelsByMake: Record<string, string[]> = {};
    for (const row of rows) {
      const key = row.make;
      if (!modelsByMake[key]) modelsByMake[key] = [];
      if (!modelsByMake[key].includes(row.model)) {
        modelsByMake[key].push(row.model);
      }
    }
    for (const make of Object.keys(modelsByMake)) {
      modelsByMake[make].sort((a, b) => a.localeCompare(b));
    }

    return { makes, models_by_make: modelsByMake };
  }

  async getBySlug(slug: string, viewer?: User | null) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        company: { select: { id: true, name: true, code: true, logoUrl: true, contactPhone: true } },
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

  async listDealerInventory(user: User, query: PaginationQueryDto = {}) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
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
    return toPaginatedResponse(items.map((item) => toDealerInventoryDto(item)), total, limit, offset);
  }

  async getDealerOne(user: User, id: string) {
    const product = await this.requireDealerProduct(user, id);
    return toDealerInventoryDto(product);
  }

  async create(user: User, dto: ProductInputDto) {
    let companyId: string;
    if (user.role === UserRole.dealer_agent) {
      if (!user.companyId) throw new ForbiddenException('forbidden_role');
      const dealerCompany = await this.prisma.company.findUnique({ where: { id: user.companyId } });
      if (dealerCompany?.kind === 'holding') throw new BadRequestException('holding_cannot_have_products');
      companyId = user.companyId;
    } else if (user.role === UserRole.admin || user.role === UserRole.super_admin) {
      if (!dto.companyId) throw new BadRequestException('company_required');
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('company_not_found');
      if (company.kind === 'holding') throw new BadRequestException('holding_cannot_have_products');
      companyId = dto.companyId;
    } else {
      throw new ForbiddenException('forbidden_role');
    }
    const id = randomUUID();
    const slug = this.buildSlug(dto, id);

    if (dto.defaultOfferId) {
      await assertDefaultOfferForCompany(this.prisma, companyId, dto.defaultOfferId);
    }
    const identity = resolveVehicleIdentityInput(dto);

    const created = await this.prisma.product.create({
      data: {
        id,
        companyId,
        slug,
        make: dto.make,
        model: dto.model,
        trim: dto.trim,
        modelYear: dto.modelYear,
        condition: dto.condition ?? VehicleCondition.used,
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
        listingStatus: ListingStatus.draft,
      },
    });
    return toDealerInventoryDto(created);
  }

  async update(user: User, id: string, dto: Partial<ProductInputDto>) {
    const product = await this.requireDealerProduct(user, id);
    if (dto.defaultOfferId) {
      await assertDefaultOfferForCompany(this.prisma, product.companyId, dto.defaultOfferId);
    }
    const identity = resolveVehicleIdentityInput(dto);
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
    return toDealerInventoryDto(updated);
  }

  async addImage(user: User, productId: string, file: Express.Multer.File) {
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
    return toDealerProductImageDto(image);
  }

  async publish(user: User, productId: string) {
    const product = await this.requireDealerProduct(user, productId);
    if (!product.price || Number(product.price) <= 0 || !product.make || !product.model) {
      throw new BadRequestException('validation_failed');
    }
    if (!product.transmission) {
      throw new BadRequestException('validation_failed');
    }
    if (product.condition === VehicleCondition.used && product.mileage == null) {
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
    return toDealerInventoryDto(updated);
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
    return toDealerInventoryDto(updated);
  }

  buildSlug(dto: Pick<ProductInputDto, 'make' | 'model' | 'trim' | 'modelYear' | 'color' | 'transmission' | 'bodyType'>, id: string) {
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
    return slugify(parts.join('-'), { lower: true, strict: true });
  }

  async getOpsOne(user: User, id: string) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        defaultOffer: { select: { id: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('listing_not_available');
    return {
      ...toDealerInventoryDto(product),
      company_name: product.company.name,
      company_code: product.company.code,
      default_offer_name: product.defaultOffer?.name ?? null,
    };
  }

  async updateOps(
    user: User,
    id: string,
    dto: Partial<ProductInputDto> & { listingStatus?: string },
  ) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('listing_not_available');
    const listingStatus =
      dto.listingStatus &&
      ['draft', 'published', 'reserved', 'sold', 'archived'].includes(dto.listingStatus)
        ? (dto.listingStatus as ListingStatus)
        : undefined;
    const identity = resolveVehicleIdentityInput(dto);
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
    return toDealerInventoryDto(updated);
  }

  async deleteOps(user: User, id: string) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const apps = await this.prisma.application.count({ where: { productId: id } });
    if (apps > 0) throw new BadRequestException('product_has_applications');
    await this.prisma.product.delete({ where: { id } });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'product',
      entityId: id,
      action: 'product_deleted',
    });
    return { ok: true };
  }

  async bulkStatus(user: User, ids: string[], listingStatus: string) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    if (!['draft', 'published', 'archived'].includes(listingStatus)) {
      throw new BadRequestException('invalid_listing_status');
    }
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { listingStatus: listingStatus as ListingStatus },
    });
    return { updated: result.count };
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
    transmission: Transmission | null;
    cylinders: number | null;
    drivetrain: Drivetrain | null;
    bodyType: BodyType | null;
    color: string | null;
    mileage: number | null;
    description: string | null;
    price: Prisma.Decimal;
    financeEligible: boolean;
    warrantyMonths: number | null;
    warrantyNotes: string | null;
    attributes?: Prisma.JsonValue | null;
    companyId: string;
    publishedAt: Date | null;
    company: { id: string; name: string; code: string | null; logoUrl: string | null };
    images: { storagePath: string }[];
    defaultOffer?: {
      annualRentRate: Prisma.Decimal;
      minDownPaymentPct: Prisma.Decimal;
      tenureOptions: Prisma.JsonValue;
    } | null;
  }) {
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
      est_monthly:
        p.financeEligible && p.defaultOffer
          ? this.estimateMonthlyFromOffer(price, p.defaultOffer)
          : null,
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
    transmission: Transmission | null;
    cylinders: number | null;
    drivetrain: Drivetrain | null;
    bodyType: BodyType | null;
    color: string | null;
    mileage: number | null;
    description: string | null;
    price: Prisma.Decimal;
    financeEligible: boolean;
    warrantyMonths: number | null;
    warrantyNotes: string | null;
    listingStatus: ListingStatus;
    defaultOfferId: string | null;
    companyId: string;
    publishedAt: Date | null;
    company: { id: string; name: string; code: string | null; logoUrl: string | null };
    images: { storagePath: string }[];
  }) {
    const card = this.toPublicCard(p);
    return {
      ...card,
      engine: p.engine,
      listing_status: p.listingStatus,
      default_offer_id: p.defaultOfferId,
    };
  }
}
