import type { ApplicationStatus, Prisma } from '@prisma/client';
import { maskCustomerSnapshot, maskPhone } from '@drivemarket/shared/domain-rules';
import { toPublicOfferDto } from '../common/offer-response.dto';
import { ruleFlagsOf } from './application-rules';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

function asNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dateOnlyOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Who is reading the DTO. Customers see their own data in full; ops roles
 * (credit, finance, admin, super-admin, group-admin) see the QID and phone
 * masked (LOS FSD §11.1 — unmasking is a separate audited action); dealer
 * agents keep the phone (they call the customer) but never the full QID.
 */
export type ApplicationAudience = 'customer' | 'ops' | 'dealer';

type Snapshot = Record<string, unknown>;

function asSnapshot(value: unknown): Snapshot | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Snapshot) : null;
}

/** Customer snapshot as the audience may see it. */
export function snapshotForAudience(snapshot: unknown, audience: ApplicationAudience): unknown {
  if (audience === 'customer') return snapshot ?? null;
  const raw = asSnapshot(snapshot);
  if (!raw) return snapshot ?? null;
  const masked = maskCustomerSnapshot(raw) ?? {};
  if (audience === 'dealer' && typeof raw.phone === 'string') {
    return { ...masked, phone: raw.phone };
  }
  return masked;
}

function customerForAudience(
  customer: { name: string | null; email: string; phone?: string | null },
  audience: ApplicationAudience,
) {
  const phone = customer.phone ?? null;
  return {
    name: customer.name,
    email: customer.email,
    phone: audience === 'ops' && phone ? maskPhone(phone) : phone,
  };
}

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
  originalName?: string | null;
  kycDocumentType?: string | null;
  verificationStatus?: string | null;
}) {
  return {
    id: doc.id,
    category: doc.category,
    mime_type: doc.mimeType ?? null,
    created_at: doc.createdAt,
    original_name: doc.originalName ?? null,
    kyc_document_type: doc.kycDocumentType ?? null,
    verification_status: doc.verificationStatus ?? null,
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

/** Prisma `TakafulPolicy` row (dates come back as `Date`, decimals as `Decimal`). */
export type TakafulPolicyRow = {
  id: string;
  applicationId: string;
  provider?: string | null;
  policyNumber?: string | null;
  coverageType?: string | null;
  coverageAmount?: DecimalLike;
  premiumAmount?: DecimalLike;
  issuedAt?: Date | null;
  effectiveFrom?: Date | null;
  expiresAt?: Date | null;
  riders?: unknown;
  status: string;
  declarationAcceptedAt?: Date | null;
  declarationVersion?: string | null;
  documentPath?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
};

const DAY_MS = 86_400_000;

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from today to the expiry date (negative once expired), null without an expiry. */
export function daysToExpiry(expiresAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.round((utcDayStart(expiresAt) - utcDayStart(now)) / DAY_MS);
}

/** Matches `TakafulPolicyDto` in packages/shared/src/types/customer-platform.ts field for field. */
export function toTakafulPolicyDto(policy: TakafulPolicyRow, now: Date = new Date()) {
  const coverageType =
    policy.coverageType === 'comprehensive' || policy.coverageType === 'third_party'
      ? policy.coverageType
      : null;
  return {
    id: policy.id,
    application_id: policy.applicationId,
    provider: policy.provider ?? null,
    policy_number: policy.policyNumber ?? null,
    coverage_type: coverageType,
    coverage_amount: asNumber(policy.coverageAmount),
    premium_amount: asNumber(policy.premiumAmount),
    issued_at: dateOnlyOrNull(policy.issuedAt),
    effective_from: dateOnlyOrNull(policy.effectiveFrom),
    expires_at: dateOnlyOrNull(policy.expiresAt),
    days_to_expiry: daysToExpiry(policy.expiresAt, now),
    riders: Array.isArray(policy.riders) ? policy.riders.map((r) => String(r)) : [],
    status: policy.status,
    declaration_accepted_at: isoOrNull(policy.declarationAcceptedAt),
    declaration_version: policy.declarationVersion ?? null,
    has_document: !!policy.documentPath,
    verified_at: isoOrNull(policy.verifiedAt),
    created_at: policy.createdAt.toISOString(),
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
  financePartnerBranchId?: string | null;
  branchId?: string | null;
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
  identityHoldReason?: string | null;
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  identityHoldClearedById?: string | null;
  /** Resolved by the detail loader (no relation on the column). */
  identityHoldClearedByName?: string | null;
  consentsCompletedAt?: Date | null;
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
  financePartner?: { id?: string; name?: string | null; code?: string | null; crmAdapter?: string | null } | null;
  branch?: { id?: string; name?: string | null; code?: string | null } | null;
  takafulPolicies?: TakafulPolicyRow[] | null;
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

/** Identity-hold + consent facts shared by every application DTO. */
export function identityAndConsentFields(app: {
  identityHoldReason?: string | null;
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  identityHoldClearedByName?: string | null;
  consentsCompletedAt?: Date | null;
}) {
  return {
    identity_hold_reason: app.identityHoldReason ?? null,
    identity_hold_at: app.identityHoldAt ?? null,
    identity_hold_cleared_at: app.identityHoldClearedAt ?? null,
    identity_hold_cleared_by_name: app.identityHoldClearedByName ?? null,
    consents_completed_at: app.consentsCompletedAt ?? null,
  };
}

/**
 * Decision reasons never reach the customer: a declined applicant sees the
 * status only (Shariah policy — no adverse-reason disclosure through the
 * product surfaces; support handles the conversation). `resubmission_comment`
 * is not a decision reason but the instruction of what to fix, so it stays.
 */
function baseApplicationFields(app: ApplicationCore, audience: ApplicationAudience) {
  const dto: Record<string, unknown> = {
    id: app.id,
    customer_user_id: app.customerUserId,
    customer_email: app.customerEmail,
    customer_snapshot: snapshotForAudience(app.customerSnapshot, audience),
    product_id: app.productId,
    company_id: app.companyId,
    offer_id: app.offerId,
    finance_partner_id: app.financePartnerId ?? null,
    pricing_snapshot: app.pricingSnapshot,
    ...(app.installmentPlan != null ? { installment_plan: app.installmentPlan } : {}),
    status: app.status,
    contract_generated: app.contractGenerated,
    resubmission_comment: app.resubmissionComment ?? null,
    submitted_at: app.submittedAt ?? null,
    activated_at: app.activatedAt ?? null,
    completed_at: app.completedAt ?? null,
    created_at: app.createdAt,
    updated_at: app.updatedAt,
    ...identityAndConsentFields(app),
  };

  if (audience === 'ops' || audience === 'dealer') {
    dto.rejection_reason = app.rejectionReason ?? null;
    dto.branch_id = app.branchId ?? null;
    dto.rule_flags = ruleFlagsOf(app.pricingSnapshot);
  }

  if (audience === 'ops') {
    dto.status_reason = app.statusReason ?? null;
    dto.finance_partner_branch_id = app.financePartnerBranchId ?? null;
  }

  return dto;
}

function applicationRelations(app: ApplicationRelations, audience: ApplicationAudience) {
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
    ...(app.customer ? { customer: customerForAudience(app.customer, audience) } : {}),
    ...(hasOfferFields(app.offer) ? { offer: toPublicOfferDto(app.offer) } : {}),
    ...(app.paymentSchedules
      ? {
          payment_schedules: app.paymentSchedules
            .filter(hasScheduleFields)
            .map((schedule) => toPaymentScheduleDto(schedule)),
        }
      : {}),
    ...(app.takafulPolicies
      ? { takaful_policies: app.takafulPolicies.map((policy) => toTakafulPolicyDto(policy)) }
      : {}),
    financing_source: app.financePartner?.crmAdapter === 'zoho' ? 'partner' : 'blox',
    finance_partner_name: app.financePartner?.name ?? null,
    branch_name: app.branch?.name ?? null,
  };
}

/** Customer-facing DTO: the owner sees their own snapshot in full. */
export function toApplicationDto(app: ApplicationCore & ApplicationRelations) {
  return {
    ...baseApplicationFields(app, 'customer'),
    ...applicationRelations(app, 'customer'),
  };
}

export function toOpsApplicationDto(app: ApplicationCore & ApplicationRelations) {
  return {
    ...baseApplicationFields(app, 'ops'),
    ...applicationRelations(app, 'ops'),
  };
}

export function toDealerApplicationDto(app: ApplicationCore & ApplicationRelations) {
  return {
    ...baseApplicationFields(app, 'dealer'),
    ...applicationRelations(app, 'dealer'),
  };
}

export function mapApplicationDto(
  app: ApplicationCore & ApplicationRelations,
  audience: ApplicationAudience,
) {
  if (audience === 'ops') return toOpsApplicationDto(app);
  if (audience === 'dealer') return toDealerApplicationDto(app);
  return toApplicationDto(app);
}

export function toApplicationBlockingDto(result: {
  blocking: boolean;
  applicationId: string | null;
  status?: ApplicationStatus | null;
  draftApplicationId?: string | null;
}) {
  return {
    blocking: result.blocking,
    application_id: result.applicationId,
    status: result.status ?? null,
    draft_application_id: result.draftApplicationId ?? null,
  };
}

/** Customer list row — like the detail DTO, carries no decision reason. */
export function toApplicationListItemDto(app: {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  submittedAt?: Date | null;
  activatedAt?: Date | null;
  contractGenerated?: boolean;
  resubmissionComment?: string | null;
  pricingSnapshot?: unknown;
  identityHoldReason?: string | null;
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  consentsCompletedAt?: Date | null;
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
    resubmission_comment: app.resubmissionComment ?? null,
    pricing_snapshot: app.pricingSnapshot ?? null,
    ...identityAndConsentFields(app),
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
  customerSnapshot?: unknown;
  pricingSnapshot?: unknown;
  installmentPlan?: unknown;
  financePartnerId?: string | null;
  branchId?: string | null;
  identityHoldReason?: string | null;
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  consentsCompletedAt?: Date | null;
  product?: { make: string; model: string; modelYear: number; slug: string; price?: DecimalLike } | null;
  company?: { name: string } | null;
  customer?: { name: string | null; email: string } | null;
  agent?: { id: string; name: string | null; email: string } | null;
  paymentSchedules?: Array<{ status: string; dueDate: Date }>;
  financePartner?: { id?: string; name?: string | null; crmAdapter?: string | null } | null;
  branch?: { id?: string; name?: string | null } | null;
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
    customer_snapshot: snapshotForAudience(app.customerSnapshot, 'ops'),
    pricing_snapshot: app.pricingSnapshot ?? null,
    installment_plan: app.installmentPlan ?? null,
    rule_flags: ruleFlagsOf(app.pricingSnapshot),
    ...identityAndConsentFields(app),
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
    finance_partner_id: app.financePartnerId ?? app.financePartner?.id ?? null,
    finance_partner_name: app.financePartner?.name ?? null,
    branch_id: app.branchId ?? app.branch?.id ?? null,
    branch_name: app.branch?.name ?? null,
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
  customerSnapshot?: unknown;
  pricingSnapshot?: unknown;
  financePartnerId?: string | null;
  branchId?: string | null;
  identityHoldReason?: string | null;
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  consentsCompletedAt?: Date | null;
  product?: { make: string; model: string; modelYear: number; slug: string } | null;
  customer?: { name: string | null; email: string; phone?: string | null } | null;
  agent?: { id: string; name: string | null; email: string } | null;
  financePartner?: { id?: string; name?: string | null } | null;
  branch?: { id?: string; name?: string | null } | null;
}) {
  return {
    id: app.id,
    status: app.status,
    created_at: app.createdAt,
    customer_snapshot: snapshotForAudience(app.customerSnapshot, 'dealer'),
    rule_flags: ruleFlagsOf(app.pricingSnapshot),
    ...identityAndConsentFields(app),
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
    finance_partner_id: app.financePartnerId ?? app.financePartner?.id ?? null,
    finance_partner_name: app.financePartner?.name ?? null,
    branch_id: app.branchId ?? app.branch?.id ?? null,
    branch_name: app.branch?.name ?? null,
  };
}
