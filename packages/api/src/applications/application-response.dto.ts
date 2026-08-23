import type { ApplicationStatus, Prisma } from '@prisma/client';
import { toPublicOfferDto } from '../common/offer-response.dto';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

function asNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type ApplicationAudience = 'customer' | 'ops' | 'dealer';

export function toApplicationProductDto(product: {
  id: string;
  slug: string;
  make: string;
  model: string;
  trim?: string | null;
  modelYear: number;
  condition?: string;
  engine?: string | null;
  transmission?: string | null;
  cylinders?: number | null;
  drivetrain?: string | null;
  bodyType?: string | null;
  color?: string | null;
  mileage?: number | null;
  description?: string | null;
  price: DecimalLike;
  financeEligible?: boolean;
  warrantyMonths?: number | null;
  warrantyNotes?: string | null;
  listingStatus?: string;
  companyId?: string;
  publishedAt?: Date | null;
  defaultOfferId?: string | null;
}) {
  return {
    id: product.id,
    slug: product.slug,
    make: product.make,
    model: product.model,
    trim: product.trim ?? null,
    model_year: product.modelYear,
    condition: product.condition ?? null,
    engine: product.engine ?? null,
    transmission: product.transmission ?? null,
    cylinders: product.cylinders ?? null,
    drivetrain: product.drivetrain ?? null,
    body_type: product.bodyType ?? null,
    color: product.color ?? null,
    mileage: product.mileage ?? null,
    description: product.description ?? null,
    price: asNumber(product.price),
    finance_eligible: product.financeEligible ?? null,
    warranty_months: product.warrantyMonths ?? null,
    warranty_notes: product.warrantyNotes ?? null,
    listing_status: product.listingStatus ?? null,
    company_id: product.companyId ?? null,
    published_at: product.publishedAt ?? null,
    default_offer_id: product.defaultOfferId ?? null,
  };
}

export function toApplicationDocumentDto(doc: {
  id: string;
  category: string;
  mimeType?: string | null;
  createdAt: Date;
}) {
  return {
    id: doc.id,
    category: doc.category,
    mime_type: doc.mimeType ?? null,
    created_at: doc.createdAt,
  };
}

export function toPaymentScheduleDto(schedule: {
  id: string;
  sequence: number;
  dueDate: Date;
  amount: DecimalLike;
  paidAmount: DecimalLike;
  remainingAmount: DecimalLike;
  status: string;
  paidAt?: Date | null;
  pendingWaiveReason?: string | null;
  pendingWaiveRequestedById?: string | null;
}) {
  return {
    id: schedule.id,
    sequence: schedule.sequence,
    due_date: schedule.dueDate,
    amount: asNumber(schedule.amount),
    paid_amount: asNumber(schedule.paidAmount),
    remaining_amount: asNumber(schedule.remainingAmount),
    status: schedule.status,
    paid_at: schedule.paidAt ?? null,
    pending_waive_reason: schedule.pendingWaiveReason ?? null,
    pending_waive_requested_by_id: schedule.pendingWaiveRequestedById ?? null,
  };
}

type ApplicationCore = {
  id: string;
  customerUserId: string;
  customerEmail: string;
  customerSnapshot: unknown;
  productId: string;
  companyId: string;
  offerId: string;
  financePartnerId?: string | null;
  leadSource?: string | null;
  pricingSnapshot: unknown;
  installmentPlan?: unknown;
  status: ApplicationStatus;
  contractGenerated: boolean;
  rejectionReason?: string | null;
  resubmissionComment?: string | null;
  statusReason?: string | null;
  submittedAt?: Date | null;
  activatedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApplicationRelations = {
  product?: Partial<Parameters<typeof toApplicationProductDto>[0]> | null;
  documents?: Array<Partial<Parameters<typeof toApplicationDocumentDto>[0]>> | null;
  company?: { id?: string; name?: string; allowDirectActivate?: boolean } | null;
  customer?: { name: string | null; email: string; phone?: string | null } | null;
  offer?: (Parameters<typeof toPublicOfferDto>[0] & Record<string, unknown>) | null;
  paymentSchedules?: Array<Partial<Parameters<typeof toPaymentScheduleDto>[0]>> | null;
  financePartner?: { name?: string | null; crmAdapter?: string | null } | null;
};

function hasProductFields(
  product: Partial<Parameters<typeof toApplicationProductDto>[0]> | null | undefined,
): product is Parameters<typeof toApplicationProductDto>[0] {
  return !!product?.id && !!product.slug && !!product.make && !!product.model && product.modelYear != null;
}

function hasOfferFields(
  offer: (Parameters<typeof toPublicOfferDto>[0] & Record<string, unknown>) | null | undefined,
): offer is Parameters<typeof toPublicOfferDto>[0] {
  return !!offer?.id && !!offer.name && offer.annualRentRate != null;
}

function hasDocumentFields(
  doc: Partial<Parameters<typeof toApplicationDocumentDto>[0]> | undefined,
): doc is Parameters<typeof toApplicationDocumentDto>[0] {
  return !!doc?.id && !!doc.category && !!doc.createdAt;
}

function hasScheduleFields(
  schedule: Partial<Parameters<typeof toPaymentScheduleDto>[0]> | undefined,
): schedule is Parameters<typeof toPaymentScheduleDto>[0] {
  return (
    !!schedule?.id &&
    schedule.sequence != null &&
    !!schedule.dueDate &&
    schedule.amount != null &&
    schedule.paidAmount != null &&
    schedule.remainingAmount != null &&
    !!schedule.status
  );
}

function baseApplicationFields(app: ApplicationCore, audience: ApplicationAudience) {
  const dto: Record<string, unknown> = {
    id: app.id,
    customer_user_id: app.customerUserId,
    customer_email: app.customerEmail,
    customer_snapshot: app.customerSnapshot,
    product_id: app.productId,
    company_id: app.companyId,
    offer_id: app.offerId,
    finance_partner_id: app.financePartnerId ?? null,
    pricing_snapshot: app.pricingSnapshot,
    ...(app.installmentPlan != null ? { installment_plan: app.installmentPlan } : {}),
    status: app.status,
    contract_generated: app.contractGenerated,
    rejection_reason: app.rejectionReason ?? null,
    resubmission_comment: app.resubmissionComment ?? null,
    submitted_at: app.submittedAt ?? null,
    activated_at: app.activatedAt ?? null,
    completed_at: app.completedAt ?? null,
    created_at: app.createdAt,
    updated_at: app.updatedAt,
  };

  if (audience === 'ops') {
    dto.status_reason = app.statusReason ?? null;
  }

  return dto;
}

function applicationRelations(app: ApplicationRelations) {
  return {
    ...(hasProductFields(app.product) ? { product: toApplicationProductDto(app.product) } : {}),
    ...(app.documents
      ? {
          documents: app.documents
            .filter(hasDocumentFields)
            .map((doc) => toApplicationDocumentDto(doc)),
        }
      : {}),
    ...(app.company?.id && app.company?.name
      ? { company: { id: app.company.id, name: app.company.name } }
      : {}),
    ...(app.customer
      ? {
          customer: {
            name: app.customer.name,
            email: app.customer.email,
            phone: app.customer.phone ?? null,
          },
        }
      : {}),
    ...(hasOfferFields(app.offer) ? { offer: toPublicOfferDto(app.offer) } : {}),
    ...(app.paymentSchedules
      ? {
          payment_schedules: app.paymentSchedules
            .filter(hasScheduleFields)
            .map((schedule) => toPaymentScheduleDto(schedule)),
        }
      : {}),
    financing_source: app.financePartner?.crmAdapter === 'zoho' ? 'partner' : 'blox',
    finance_partner_name: app.financePartner?.name ?? null,
  };
}

export function toApplicationDto(app: ApplicationCore & ApplicationRelations) {
  return {
    ...baseApplicationFields(app, 'customer'),
    ...applicationRelations(app),
  };
}

export function toOpsApplicationDto(app: ApplicationCore & ApplicationRelations) {
  return {
    ...baseApplicationFields(app, 'ops'),
    ...applicationRelations(app),
  };
}

export function mapApplicationDto(
  app: ApplicationCore & ApplicationRelations,
  audience: ApplicationAudience,
) {
  return audience === 'ops' ? toOpsApplicationDto(app) : toApplicationDto(app);
}

export function toApplicationBlockingDto(result: { blocking: boolean; applicationId: string | null }) {
  return {
    blocking: result.blocking,
    application_id: result.applicationId,
  };
}

export function toApplicationListItemDto(app: {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  submittedAt?: Date | null;
  activatedAt?: Date | null;
  contractGenerated?: boolean;
  rejectionReason?: string | null;
  resubmissionComment?: string | null;
  pricingSnapshot?: unknown;
  product?: {
    make: string;
    model: string;
    modelYear: number;
    slug: string;
    price: DecimalLike;
  } | null;
}) {
  return {
    id: app.id,
    status: app.status,
    created_at: app.createdAt,
    submitted_at: app.submittedAt ?? null,
    activated_at: app.activatedAt ?? null,
    contract_generated: app.contractGenerated ?? false,
    rejection_reason: app.rejectionReason ?? null,
    resubmission_comment: app.resubmissionComment ?? null,
    pricing_snapshot: app.pricingSnapshot ?? null,
    ...(app.product
      ? {
          product: {
            make: app.product.make,
            model: app.product.model,
            model_year: app.product.modelYear,
            slug: app.product.slug,
            price: asNumber(app.product.price),
          },
        }
      : {}),
  };
}

export function toOpsApplicationQueueItemDto(app: {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  submittedAt?: Date | null;
  pricingSnapshot?: unknown;
  installmentPlan?: unknown;
  product?: { make: string; model: string; modelYear: number; slug: string; price?: DecimalLike } | null;
  company?: { name: string } | null;
  customer?: { name: string | null; email: string } | null;
  agent?: { id: string; name: string | null; email: string } | null;
  paymentSchedules?: Array<{ status: string; dueDate: Date }>;
  financePartner?: { name?: string | null; crmAdapter?: string | null } | null;
}) {
  const pricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
  const plan = app.installmentPlan as Record<string, unknown> | null | undefined;
  const sellingPrice = Number(pricing.selling_price ?? pricing.list_price ?? app.product?.price ?? 0);
  const monthly = Number(plan?.monthlyAmount ?? pricing.monthly ?? 0);

  return {
    id: app.id,
    status: app.status,
    created_at: app.createdAt,
    submitted_at: app.submittedAt ?? null,
    pricing_snapshot: app.pricingSnapshot ?? null,
    installment_plan: app.installmentPlan ?? null,
    deal_summary: {
      selling_price: sellingPrice,
      monthly,
      rate: Number(pricing.rate ?? plan?.annualRentalRate ?? 0),
    },
    payment_health: derivePaymentHealth(app.status, app.paymentSchedules ?? []),
    risk_level: deriveRiskLevel(app.status, app.paymentSchedules ?? []),
    ...(app.product
      ? {
          product: {
            make: app.product.make,
            model: app.product.model,
            model_year: app.product.modelYear,
            slug: app.product.slug,
            price: app.product.price != null ? asNumber(app.product.price) : null,
          },
        }
      : {}),
    ...(app.company ? { company: { name: app.company.name } } : {}),
    ...(app.customer
      ? { customer: { name: app.customer.name, email: app.customer.email } }
      : {}),
    ...(app.agent
      ? { agent: { id: app.agent.id, name: app.agent.name, email: app.agent.email } }
      : { agent: null }),
    financing_source: app.financePartner?.crmAdapter === 'zoho' ? 'partner' : 'blox',
    finance_partner_name: app.financePartner?.name ?? null,
  };
}

function derivePaymentHealth(
  status: ApplicationStatus,
  schedules: Array<{ status: string; dueDate: Date }>,
): 'none' | 'on_track' | 'overdue' | 'paid' {
  if (schedules.length === 0) return 'none';
  if (schedules.every((s) => s.status === 'paid')) return 'paid';
  if (schedules.some((s) => s.status === 'overdue')) return 'overdue';
  return 'on_track';
}

function deriveRiskLevel(
  status: ApplicationStatus,
  schedules: Array<{ status: string; dueDate: Date }>,
): 'low' | 'medium' | 'high' {
  if (status === 'rejected' || status === 'submission_cancelled') return 'high';
  const overdue = schedules.filter((s) => s.status === 'overdue').length;
  if (overdue >= 2) return 'high';
  if (overdue === 1 || status === 'resubmission_required') return 'medium';
  return 'low';
}

export function toDealerApplicationListItemDto(app: {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  product?: { make: string; model: string; modelYear: number; slug: string } | null;
  customer?: { name: string | null; email: string; phone?: string | null } | null;
  agent?: { id: string; name: string | null; email: string } | null;
}) {
  return {
    id: app.id,
    status: app.status,
    created_at: app.createdAt,
    ...(app.product
      ? {
          product: {
            make: app.product.make,
            model: app.product.model,
            model_year: app.product.modelYear,
            slug: app.product.slug,
          },
        }
      : {}),
    ...(app.customer
      ? {
          customer: {
            name: app.customer.name,
            email: app.customer.email,
            phone: app.customer.phone ?? null,
          },
        }
      : {}),
    ...(app.agent
      ? { agent: { id: app.agent.id, name: app.agent.name, email: app.agent.email } }
      : { agent: null }),
  };
}
