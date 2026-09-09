import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Application,
  ApplicationStatus,
  Branch,
  Company,
  ConsentChannel,
  DocumentCategory,
  FinancePartner,
  Offer,
  PaymentSchedule,
  Prisma,
  Product,
  TakafulProvider,
  User,
  UserRole,
} from '@prisma/client';
import { buildPricingSnapshot as buildCanonicalPricingSnapshot } from '@drivemarket/shared/pricing';
import { CONSENT_CATALOG, CONSENT_CODES, type ConsentCodeValue } from '@drivemarket/shared/domain-rules';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { missingDocumentsForApplication } from '../../../src/applications/application-documents';
import { buildScheduleDrafts } from '../../../src/applications/payment-schedules';
import { consentTextHash } from '../../../src/consents/consent-logic';

/**
 * Qatar IDs used across the specs (C YY NNN SSSSS — century, birth year,
 * ISO numeric nationality, serial). All parse as valid with `parseQid`.
 */
export const QID = {
  /** Indian national born 1990 → expat. */
  expat: '29035612345',
  /** Jordanian national born 1990 → expat (a different person from `expat`). */
  expatAlt: '29040012346',
  /** Qatari national born 1985. */
  qatari: '28563412345',
} as const;

/** Vehicle identity a listing needs before an application may reserve it. */
export const VEHICLE_IDENTITY = {
  vin: 'JTNB11HK2J3000001',
  chassisNumber: 'CH-2024-000001',
  engineNumber: 'ENG-2AR-000001',
} as const;

export type PricingOptions = { tenureMonths?: number; downPaymentPct?: number };

/**
 * Rule-compliant pricing snapshot for the seeded 12.5% offer: 20% down
 * satisfies both the new-car (20%) and used-car (15%) minimums, so a customer
 * or dealer create passes the product rules without further tweaks.
 */
export function buildPricingSnapshot(listPrice: number, opts: PricingOptions = {}) {
  return buildCanonicalPricingSnapshot({
    listPrice,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: opts.tenureMonths ?? 36,
    downPaymentPct: opts.downPaymentPct ?? 20,
  });
}

/**
 * Realistic individual applicant (expatriate, privately employed) in the
 * shared customer-snapshot shape accepted by `POST /api/applications`.
 */
export function customerSnapshotFixture(overrides: Record<string, unknown> = {}) {
  return {
    full_name: 'Asha Verma',
    firstName: 'Asha',
    lastName: 'Verma',
    gender: 'female',
    dateOfBirth: '1990-04-12',
    phone: '+97455512345',
    qid: QID.expat,
    applicantType: 'individual',
    residenceDuration: '3-5-years',
    city: 'Doha',
    address: { line1: 'Building 12, Street 850', area: 'Al Sadd', city: 'Doha', zone: '38' },
    employment: {
      company: 'Gulf Logistics WLL',
      jobTitle: 'Operations Manager',
      employmentType: 'private-local',
      employmentDuration: '3-5-years',
      salary: 18000,
    },
    monthlyIncome: 18000,
    monthlyLiabilities: 1500,
    hasGuarantor: false,
    ...overrides,
  };
}

export async function seedCompany(prisma: PrismaService, name: string) {
  return prisma.company.create({
    data: {
      name,
      code: `${name.toLowerCase().replace(/\s+/g, '-')}-${randomUUID().slice(0, 6)}`,
      status: 'active',
      allowDirectActivate: true,
    },
  });
}

export async function seedOffer(prisma: PrismaService, companyId?: string): Promise<Offer> {
  return prisma.offer.create({
    data: {
      name: 'Standard plan',
      annualRentRate: 12.5,
      tenureOptions: [12, 24, 36, 48, 60],
      minDownPaymentPct: 10,
      status: 'active',
      companyId: companyId ?? null,
    },
  });
}

export async function seedProduct(
  prisma: PrismaService,
  opts: {
    companyId: string;
    offerId: string;
    price?: number;
    make?: string;
    model?: string;
    modelYear?: number;
    condition?: 'new' | 'used';
    /** Free-form spec JSON; the product rules read it to spot a motorcycle. */
    attributes?: Record<string, unknown>;
    /** VIN + chassis + engine number on the listing (default true — most listings are complete). */
    vehicleIdentity?: boolean;
  },
): Promise<Product> {
  const identity = opts.vehicleIdentity ?? true;
  return prisma.product.create({
    data: {
      companyId: opts.companyId,
      slug: `vehicle-${randomUUID().slice(0, 8)}`,
      make: opts.make ?? 'Toyota',
      model: opts.model ?? 'Camry',
      modelYear: opts.modelYear ?? 2024,
      condition: opts.condition ?? 'used',
      ...(opts.attributes ? { attributes: opts.attributes } : {}),
      price: opts.price ?? 100_000,
      listingStatus: 'published',
      financeEligible: true,
      defaultOfferId: opts.offerId,
      publishedAt: new Date(),
      ...(identity
        ? {
            vin: `${VEHICLE_IDENTITY.vin.slice(0, 11)}${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`,
            chassisNumber: `CH-${randomUUID().slice(0, 8)}`,
            engineNumber: `ENG-${randomUUID().slice(0, 8)}`,
          }
        : {}),
    },
  });
}

/** Puts (or clears) the VIN / chassis / engine identity on a listing. */
export async function setVehicleIdentity(
  prisma: PrismaService,
  productId: string,
  identity: { vin: string; chassisNumber: string; engineNumber: string } | null = VEHICLE_IDENTITY,
): Promise<Product> {
  return prisma.product.update({
    where: { id: productId },
    data: identity
      ? { vin: identity.vin, chassisNumber: identity.chassisNumber, engineNumber: identity.engineNumber }
      : { vin: null, chassisNumber: null, engineNumber: null },
  });
}

export async function assignFinanceOfficer(
  prisma: PrismaService,
  userId: string,
  companyId: string,
) {
  await prisma.financeOfficerCompany.create({
    data: { userId, companyId },
  });
}

export async function assignCreditOfficer(
  prisma: PrismaService,
  userId: string,
  companyId: string,
) {
  await prisma.creditOfficerCompany.create({
    data: { userId, companyId },
  });
}

export async function setUserRole(
  prisma: PrismaService,
  userId: string,
  role: UserRole,
  extra: Partial<
    Pick<User, 'companyId' | 'financeScope' | 'creditScope' | 'isActive' | 'homeBranchId' | 'financePartnerId'>
  > = {},
) {
  return prisma.user.update({
    where: { id: userId },
    data: { role, ...extra },
  });
}

export async function seedBranch(
  prisma: PrismaService,
  companyId: string,
  opts: { code?: string; name?: string; city?: string; active?: boolean } = {},
): Promise<Branch> {
  return prisma.branch.create({
    data: {
      companyId,
      code: opts.code ?? `BR-${randomUUID().slice(0, 6).toUpperCase()}`,
      name: opts.name ?? 'Main showroom',
      city: opts.city ?? 'Doha',
      active: opts.active ?? true,
    },
  });
}

export async function seedFinancePartner(
  prisma: PrismaService,
  opts: {
    code?: string;
    name?: string;
    isDefaultLender?: boolean;
    active?: boolean;
    crmAdapter?: 'none' | 'zoho';
  } = {},
): Promise<FinancePartner> {
  const code = opts.code ?? `fp-${randomUUID().slice(0, 6)}`;
  return prisma.financePartner.create({
    data: {
      code,
      name: opts.name ?? `Finance partner ${code}`,
      active: opts.active ?? true,
      isDefaultLender: opts.isDefaultLender ?? false,
      crmAdapter: opts.crmAdapter ?? 'none',
    },
  });
}

export async function seedTakafulProvider(
  prisma: PrismaService,
  opts: {
    code: string;
    name: string;
    comprehensiveRatePct: number;
    thirdPartyAnnual?: number | null;
    minContribution?: number | null;
    riders?: Array<{ code: string; label: string; labelAr?: string; annualAmount: number }>;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<TakafulProvider> {
  return prisma.takafulProvider.create({
    data: {
      code: opts.code,
      name: opts.name,
      comprehensiveRatePct: opts.comprehensiveRatePct,
      thirdPartyAnnual: opts.thirdPartyAnnual ?? null,
      minContribution: opts.minContribution ?? null,
      riders: (opts.riders ?? []) as unknown as Prisma.InputJsonValue,
      active: opts.active ?? true,
      sortOrder: opts.sortOrder ?? 0,
    },
  });
}

export async function seedDraftApplication(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
): Promise<Application> {
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price));
  return prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
        employment: 'Test Corp',
        income: 15000,
      },
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: 'draft',
    },
  });
}

/**
 * Generic application row for analytics / scoping tests: any status, with
 * optional attribution (agent, branch) and lifecycle timestamps.
 */
export async function seedApplicationRow(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
    status: ApplicationStatus;
    submittedAt?: Date | null;
    activatedAt?: Date | null;
    createdAt?: Date;
    agentUserId?: string | null;
    branchId?: string | null;
    financePartnerId?: string | null;
    customerSnapshot?: Record<string, unknown>;
    consentsCompletedAt?: Date | null;
  },
): Promise<Application> {
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price));
  return prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: (opts.customerSnapshot ?? {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
        applicantType: 'individual',
      }) as Prisma.InputJsonValue,
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: opts.status,
      submittedAt: opts.submittedAt ?? null,
      activatedAt: opts.activatedAt ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      agentUserId: opts.agentUserId ?? null,
      branchId: opts.branchId ?? null,
      financePartnerId: opts.financePartnerId ?? null,
      consentsCompletedAt: opts.consentsCompletedAt ?? null,
    },
  });
}

/** A `status_transition` audit row, timestamped so funnel durations are deterministic. */
export async function seedStatusTransition(
  prisma: PrismaService,
  opts: {
    applicationId: string;
    from: ApplicationStatus;
    to: ApplicationStatus;
    at: Date;
    actorUserId?: string | null;
  },
) {
  return prisma.activityLog.create({
    data: {
      actorUserId: opts.actorUserId ?? null,
      entityType: 'application',
      entityId: opts.applicationId,
      action: 'status_transition',
      fromValue: opts.from,
      toValue: opts.to,
      createdAt: opts.at,
    },
  });
}

export async function seedActiveApplicationWithSchedule(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
): Promise<{ application: Application; schedule: PaymentSchedule }> {
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price));
  const application = await prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
      },
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: 'active',
      activatedAt: new Date(),
    },
  });

  const schedule = await prisma.paymentSchedule.create({
    data: {
      applicationId: application.id,
      sequence: 1,
      dueDate: new Date(),
      amount: pricingSnapshot.monthly,
      paidAmount: 0,
      remainingAmount: pricingSnapshot.monthly,
      status: 'pending',
    },
  });

  return { application, schedule };
}

/**
 * Active financing with the complete amortised schedule (one row per tenure
 * month, due dates monthly from activation) — what `POST /ops/applications/:id/activate` builds.
 */
export async function seedActiveApplicationWithFullSchedule(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
    activatedAt?: Date;
    pricing?: PricingOptions;
  },
): Promise<{ application: Application; schedules: PaymentSchedule[] }> {
  const activatedAt = opts.activatedAt ?? new Date();
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price), opts.pricing);
  const application = await prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
        applicantType: 'individual',
      },
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: 'active',
      submittedAt: activatedAt,
      activatedAt,
    },
  });
  const drafts = buildScheduleDrafts(pricingSnapshot as unknown as Record<string, unknown>, activatedAt);
  await prisma.paymentSchedule.createMany({
    data: drafts.map((draft) => ({
      applicationId: application.id,
      sequence: draft.sequence,
      dueDate: draft.dueDate,
      amount: draft.amount,
      paidAmount: 0,
      remainingAmount: draft.amount,
      status: 'pending' as const,
    })),
  });
  const schedules = await prisma.paymentSchedule.findMany({
    where: { applicationId: application.id },
    orderBy: { sequence: 'asc' },
  });
  return { application, schedules };
}

/**
 * Identity exactly as the KYC platform delivers it (BRD Qatar e-KYC BR-3/FR-3):
 * the verified `qid_front` (+ `qid_back`) rows `KycBridgeService.syncDocuments`
 * writes onto the application, stored under the `qid` category.
 *
 * With `KYC_EKYC_REQUIRED` on — the default whenever the KYC platform is
 * configured — this, and not a QID photo the customer uploads by hand, is what
 * satisfies the identity slot. Use it wherever a journey has to get past that
 * slot as a customer.
 */
export async function seedVerifiedEkycIdentity(
  prisma: PrismaService,
  applicationId: string,
  opts: {
    /** Defaults to the application's customer, which is who the bridge attributes the sync to. */
    uploadedById?: string;
    /** Hosted capture sometimes stores only the front; `false` seeds `qid_front` alone. */
    includeBack?: boolean;
    /** `verified` (default) satisfies the slot; `processing` / `rejected` do not. */
    verificationStatus?: 'verified' | 'processing' | 'rejected';
    createdAt?: Date;
  } = {},
) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { customerUserId: true },
  });
  const uploadedById = opts.uploadedById ?? application.customerUserId;
  const status = opts.verificationStatus ?? 'verified';
  const types = opts.includeBack === false ? (['qid_front'] as const) : (['qid_front', 'qid_back'] as const);

  const documents = [];
  for (const kycDocumentType of types) {
    documents.push(
      await prisma.applicationDocument.create({
        data: {
          applicationId,
          category: 'qid',
          storagePath: `kyc://${applicationId}/${kycDocumentType}`,
          mimeType: 'image/jpeg',
          originalName: kycDocumentType === 'qid_front' ? 'QID Front' : 'QID Back',
          uploadedById,
          kycDocumentId: `kyc-doc-${randomUUID().slice(0, 8)}`,
          kycDocumentType,
          verificationStatus: status,
          reviewStatus: status === 'rejected' ? 'fail' : 'pass',
          ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
        },
      }),
    );
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { kycStatus: status === 'verified' ? 'verified' : 'processing' },
  });

  return documents;
}

/**
 * Every document slot the application's own profile requires (residency,
 * employment type, guarantor — not just the legacy core three): identity from a
 * verified e-KYC capture, everything else as a manual upload by `uploadedById`.
 */
export async function seedRequiredDocuments(
  prisma: PrismaService,
  applicationId: string,
  uploadedById: string,
) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { customerSnapshot: true },
  });
  const required = missingDocumentsForApplication(application.customerSnapshot, []);

  for (const category of required) {
    if (category === 'qid') continue;
    await prisma.applicationDocument.create({
      data: {
        applicationId,
        category: category as DocumentCategory,
        storagePath: `${applicationId}/${category}/test.pdf`,
        uploadedById,
      },
    });
  }

  if (required.includes('qid')) {
    await seedVerifiedEkycIdentity(prisma, applicationId);
  }
}

/** One application document row, optionally back-dated (document freshness tests). */
export async function seedApplicationDocument(
  prisma: PrismaService,
  opts: {
    applicationId: string;
    category: DocumentCategory;
    uploadedById: string;
    createdAt?: Date;
    originalName?: string;
  },
) {
  return prisma.applicationDocument.create({
    data: {
      applicationId: opts.applicationId,
      category: opts.category,
      storagePath: `${opts.applicationId}/${opts.category}/${randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      originalName: opts.originalName ?? `${opts.category}.pdf`,
      uploadedById: opts.uploadedById,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

/**
 * Consent ledger rows exactly as `ConsentsService.record` writes them (current
 * catalog version, hashed text), and — when an application is given — the
 * `consentsCompletedAt` stamp the submit gate reads.
 */
export async function seedConsentRecords(
  prisma: PrismaService,
  opts: {
    userId: string;
    applicationId?: string | null;
    codes?: readonly ConsentCodeValue[];
    version?: string;
    locale?: 'en' | 'ar';
    channel?: ConsentChannel;
    acceptedAt?: Date;
    stampApplication?: boolean;
  },
) {
  const codes = opts.codes ?? CONSENT_CODES;
  const locale = opts.locale ?? 'en';
  const acceptedAt = opts.acceptedAt ?? new Date();
  await prisma.consentRecord.createMany({
    data: codes.map((code) => ({
      userId: opts.userId,
      applicationId: opts.applicationId ?? null,
      code,
      version: opts.version ?? CONSENT_CATALOG[code].version,
      textHash: consentTextHash(code, locale),
      locale,
      channel: opts.channel ?? 'web',
      acceptedAt,
    })),
  });
  if (opts.applicationId && opts.stampApplication !== false) {
    await prisma.application.update({
      where: { id: opts.applicationId },
      data: { consentsCompletedAt: acceptedAt },
    });
  }
}

export async function seedUnderReviewApplication(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
) {
  const app = await seedDraftApplication(prisma, opts);
  await seedRequiredDocuments(prisma, app.id, opts.customer.id);
  return prisma.application.update({
    where: { id: app.id },
    data: { status: 'under_review', submittedAt: new Date() },
  });
}

export async function seedPassingComplianceCheck(
  prisma: PrismaService,
  applicationId: string,
  verifiedByUserId?: string,
) {
  return prisma.complianceCheck.create({
    data: {
      applicationId,
      provider: 'integration-test',
      identityStatus: 'pass',
      sanctionsStatus: 'pass',
      overallStatus: 'pass',
      qidScreened: '28012345678',
      applicantName: 'Integration Test Applicant',
      verifiedByUserId,
    },
  });
}

export async function seedDownPaymentRequiredApplication(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
) {
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price));
  return prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
      },
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: 'down_payment_required',
    },
  });
}

export async function seedPendingFinanceActivationApplication(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
) {
  const pricingSnapshot = buildPricingSnapshot(Number(opts.product.price));
  const application = await prisma.application.create({
    data: {
      customerUserId: opts.customer.id,
      customerEmail: opts.customer.email,
      customerSnapshot: {
        full_name: opts.customer.name,
        phone: '+97450000000',
        qid: '28012345678',
      },
      productId: opts.product.id,
      companyId: opts.company.id,
      offerId: opts.offer.id,
      pricingSnapshot,
      status: 'pending_finance_activation',
    },
  });

  await prisma.paymentEvent.create({
    data: {
      applicationId: application.id,
      type: 'down_payment',
      amount: pricingSnapshot.down_payment,
    },
  });

  return application;
}

export async function seedApplicationWithContractPdf(
  prisma: PrismaService,
  opts: {
    customer: User;
    company: Company;
    product: Product;
    offer: Offer;
  },
) {
  const app = await seedDraftApplication(prisma, opts);
  const contractPdfPath = `${app.id}/generated/contract.pdf`;
  const updated = await prisma.application.update({
    where: { id: app.id },
    data: {
      status: 'contract_signing_required',
      contractGenerated: true,
      contractPdfPath,
    },
  });

  const full = path.join(process.cwd(), '.uploads', 'contracts', contractPdfPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from('%PDF-1.4 integration contract'));

  return updated;
}
