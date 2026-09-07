import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, User, VehicleCondition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import {
  GENDER_VALUES,
  RESIDENCE_DURATION_VALUES,
  type GenderValue,
} from '../applications/customer-snapshot';
import { ProductsService } from '../products/products.service';
import { CustomerPaymentsService } from '../payments/customer-payments.service';
import { CreditsService } from '../credits/credits.service';

type Calculator = {
  termMonths?: number;
  downPayment?: number;
  annualRentalRate?: number;
  salary?: number;
  loanAmount?: number;
  monthlyPayment?: number;
  employmentType?: string;
  durationOfResidence?: string;
};

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apps: ApplicationsService,
    private readonly products: ProductsService,
    private readonly customerPayments: CustomerPaymentsService,
    private readonly credits: CreditsService,
  ) {}

  async listVehicles(query: Record<string, string | string[] | undefined>) {
    // Repeated query keys arrive as arrays; take the first value so a
    // duplicated `limit` cannot reach Prisma as a non-number (was a 500).
    const str = (v: string | string[] | undefined): string | undefined => {
      const first = Array.isArray(v) ? v[0] : v;
      const trimmed = first?.trim();
      return trimmed ? trimmed : undefined;
    };
    const num = (v: string | string[] | undefined): number | undefined => {
      const s = str(v);
      if (s === undefined) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const condition = str(query.condition)?.toLowerCase();
    const page = await this.products.listPublished({
      make: str(query.make),
      model: str(query.model),
      q: str(query.q),
      condition:
        condition === 'new' || condition === 'used'
          ? (condition as VehicleCondition)
          : condition === 'old'
            ? VehicleCondition.used
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
      items: (page.items ?? []).map((p: Record<string, unknown>) => this.toVehicle(p)),
    };
  }

  async getVehicle(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } }, defaultOffer: true, company: true },
    });
    if (!product || product.listingStatus !== ListingStatus.published) {
      throw new NotFoundException('vehicle_not_found');
    }
    return this.toVehicle({
      ...product,
      price: product.price,
      images: product.images,
    });
  }

  private toVehicle(p: Record<string, unknown>) {
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

  /** List cards expose `primary_image`; detail rows expose Prisma `images[]`. */
  private normalizeImages(p: Record<string, unknown>): string[] {
    const out: string[] = [];

    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        const url = this.imageUrlFrom(img);
        if (url) out.push(url);
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

  private imageUrlFrom(img: unknown): string | null {
    if (typeof img === 'string' && img.trim()) return img.trim();
    if (img && typeof img === 'object') {
      const row = img as Record<string, unknown>;
      for (const key of ['storagePath', 'storage_path', 'url', 'src', 'path']) {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
    }
    return null;
  }

  async createApplication(
    user: User,
    dto: {
      vehicleId: string;
      calculator?: Calculator;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      nationalId: string;
      nationality?: string;
      gender?: string;
      dateOfBirth?: string;
      residenceDuration?: string;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.vehicleId },
      include: { defaultOffer: true },
    });
    if (!product?.defaultOfferId) throw new BadRequestException('listing_not_available');

    const offer = await this.prisma.offer.findUnique({ where: { id: product.defaultOfferId } });
    if (!offer) throw new BadRequestException('listing_not_available');

    const listPrice = Number(product.price);
    const down = Number(dto.calculator?.downPayment ?? 0);
    const downPct = listPrice > 0 ? (down / listPrice) * 100 : Number(offer.minDownPaymentPct);

    // Same shared snapshot shape as the web stepper and the dealer wizard, so
    // the same validation (QID-derived residency, DOB cross-check, product
    // rules, identity dedup) applies to mobile applicants.
    const genderRaw = String(dto.gender ?? '').trim().toLowerCase();
    const gender = (GENDER_VALUES as readonly string[]).includes(genderRaw)
      ? (genderRaw as GenderValue)
      : undefined;
    const residenceDurationRaw = dto.residenceDuration ?? dto.calculator?.durationOfResidence;
    const residenceDuration = RESIDENCE_DURATION_VALUES.includes(String(residenceDurationRaw ?? ''))
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

  async dashboard(user: User) {
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

  async offer(user: User, applicationId: string) {
    const app = await this.apps.getOne(user, applicationId);
    const pricing = (app as { pricing_snapshot?: Record<string, unknown> }).pricing_snapshot ?? {};
    return {
      application_id: applicationId,
      status: (app as { status?: string }).status,
      pricing_snapshot: pricing,
      offer: (app as { offer?: unknown }).offer ?? null,
    };
  }

  async acceptOffer(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();
    if (app.status === 'draft') {
      return this.apps.submit(user, applicationId);
    }
    return { ok: true, status: app.status };
  }

  async preDisbursal(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { documents: true },
    });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();
    const qidVerified = app.documents.some(
      (d) => d.category === 'qid' && d.verificationStatus === 'verified',
    );
    return {
      application_id: applicationId,
      status: app.status,
      kyc_status: app.kycStatus,
      qid_verified: qidVerified,
      contract_generated: app.contractGenerated,
      signed_contract: Boolean(app.signedContractPath),
    };
  }

  async completePreDisbursal(user: User, applicationId: string) {
    return this.preDisbursal(user, applicationId);
  }

  async paymentsHub(user: User) {
    return this.customerPayments.paymentsHub(user);
  }

  async registerDeviceToken(user: User, input: { platform: string; fcmToken: string; appVersion?: string }) {
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

  async listMineFlattened(user: User) {
    const page = await this.apps.listMine(user, { limit: 50, offset: 0 });
    return page;
  }
}
