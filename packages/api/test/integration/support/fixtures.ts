import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Application,
  Company,
  Offer,
  PaymentSchedule,
  Product,
  User,
  UserRole,
} from '@prisma/client';
import { buildPricingSnapshot as buildCanonicalPricingSnapshot } from '@drivemarket/shared/pricing';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { REQUIRED_APPLICATION_DOC_CATEGORIES } from '../../../src/applications/application-documents';

export function buildPricingSnapshot(listPrice: number) {
  return buildCanonicalPricingSnapshot({
    listPrice,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: 36,
    downPaymentPct: 10,
  });
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
  opts: { companyId: string; offerId: string; price?: number },
): Promise<Product> {
  return prisma.product.create({
    data: {
      companyId: opts.companyId,
      slug: `vehicle-${randomUUID().slice(0, 8)}`,
      make: 'Toyota',
      model: 'Camry',
      modelYear: 2024,
      price: opts.price ?? 100_000,
      listingStatus: 'published',
      financeEligible: true,
      defaultOfferId: opts.offerId,
      publishedAt: new Date(),
    },
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
  extra: Partial<Pick<User, 'companyId' | 'financeScope' | 'creditScope' | 'isActive'>> = {},
) {
  return prisma.user.update({
    where: { id: userId },
    data: { role, ...extra },
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

export async function seedRequiredDocuments(
  prisma: PrismaService,
  applicationId: string,
  uploadedById: string,
) {
  for (const category of REQUIRED_APPLICATION_DOC_CATEGORIES) {
    await prisma.applicationDocument.create({
      data: {
        applicationId,
        category,
        storagePath: `${applicationId}/${category}/test.pdf`,
        uploadedById,
      },
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
