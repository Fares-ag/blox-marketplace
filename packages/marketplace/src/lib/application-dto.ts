import type { InstallmentPlan } from '@drivemarket/shared';

/**
 * The API returns snake_case application DTOs (`payment_schedules`,
 * `pricing_snapshot`, `created_at`, `product.model_year`, …) while the customer
 * pages were written against camelCase view models. Until QA 2026-09-05 the
 * detail panel therefore never saw schedules, pricing or rejection reasons.
 * Normalise once at the fetch boundary; both spellings are accepted so a future
 * camelCase API keeps working.
 */
type Raw = Record<string, unknown>;

function pick<T>(raw: Raw, camel: string, snake: string): T | undefined {
  const value = raw[camel] ?? raw[snake];
  return value === undefined ? undefined : (value as T);
}

export type CustomerApplicationDocument = {
  id: string;
  category: string;
  mimeType?: string | null;
  createdAt: string;
  originalName?: string | null;
  kycDocumentType?: string | null;
  verificationStatus?: string | null;
};

export type CustomerApplicationSchedule = {
  id: string;
  sequence: number;
  dueDate: string;
  amount: string | number;
  status: string;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  paidAt?: string | null;
};

/** Camel-cased `TakafulPolicyDto` (the API also serves it from `GET /api/applications/:id/takaful`). */
export type CustomerApplicationTakaful = {
  id: string;
  applicationId: string | null;
  provider: string | null;
  policyNumber: string | null;
  coverageType: string | null;
  coverageAmount: number | null;
  premiumAmount: number | null;
  issuedAt: string | null;
  effectiveFrom: string | null;
  expiresAt: string | null;
  /** Days until expiry (negative when expired), null when no expiry recorded. */
  daysToExpiry: number | null;
  riders: string[];
  status: string;
  declarationAcceptedAt: string | null;
  declarationVersion: string | null;
  hasDocument: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

/** Soft product-rule violation stored on `pricing_snapshot.rule_flags` for credit review. */
export type CustomerApplicationRuleFlag = {
  code: string;
  severity: 'hard' | 'soft';
  params: Record<string, string | number>;
};

export type CustomerApplication = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  pricingSnapshot?: Record<string, unknown> | null;
  installmentPlan?: InstallmentPlan | null;
  /**
   * Customers never see a decision reason (wave 2): a declined application
   * renders a neutral card. Only the resubmission request — an instruction,
   * not a reason — is surfaced.
   */
  resubmissionComment?: string | null;
  contractGenerated?: boolean;
  /** Identity-level dedup hold (QID on file with different name/DOB). */
  identityHold?: { reason: string; heldAt: string; clearedAt: string | null } | null;
  consentsCompletedAt?: string | null;
  lenderId?: string | null;
  lenderName?: string | null;
  financingSource?: 'blox' | 'partner' | null;
  dealerName?: string | null;
  branchName?: string | null;
  ruleFlags?: CustomerApplicationRuleFlag[];
  takafulPolicies?: CustomerApplicationTakaful[];
  customerSnapshot?: Record<string, unknown> | null;
  product?: {
    make?: string;
    model?: string;
    slug?: string;
    modelYear?: number;
    price?: number;
  };
  documents?: CustomerApplicationDocument[];
  paymentSchedules?: CustomerApplicationSchedule[];
};

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function asNullableIso(value: unknown): string | null {
  if (value == null) return null;
  return asIso(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTakafulPolicy(p: Raw): CustomerApplicationTakaful {
  const riders = pick<unknown>(p, 'riders', 'riders');
  return {
    id: String(p.id),
    applicationId: pick<string | null>(p, 'applicationId', 'application_id') ?? null,
    provider: (p.provider as string | null) ?? null,
    policyNumber: pick<string | null>(p, 'policyNumber', 'policy_number') ?? null,
    coverageType: pick<string | null>(p, 'coverageType', 'coverage_type') ?? null,
    coverageAmount: asNumberOrNull(pick(p, 'coverageAmount', 'coverage_amount')),
    premiumAmount: asNumberOrNull(pick(p, 'premiumAmount', 'premium_amount')),
    issuedAt: asNullableIso(pick(p, 'issuedAt', 'issued_at')),
    effectiveFrom: asNullableIso(pick(p, 'effectiveFrom', 'effective_from')),
    expiresAt: asNullableIso(pick(p, 'expiresAt', 'expires_at')),
    daysToExpiry: asNumberOrNull(pick(p, 'daysToExpiry', 'days_to_expiry')),
    riders: Array.isArray(riders) ? riders.map((r) => String(r)) : [],
    status: String(p.status ?? 'declared'),
    declarationAcceptedAt: asNullableIso(pick(p, 'declarationAcceptedAt', 'declaration_accepted_at')),
    declarationVersion: pick<string | null>(p, 'declarationVersion', 'declaration_version') ?? null,
    hasDocument: Boolean(pick(p, 'hasDocument', 'has_document') ?? false),
    verifiedAt: asNullableIso(pick(p, 'verifiedAt', 'verified_at')),
    createdAt: asIso(pick(p, 'createdAt', 'created_at')),
  };
}

function normalizeRuleFlags(raw: Raw, pricing: Record<string, unknown> | null): CustomerApplicationRuleFlag[] {
  const source = pick<unknown>(raw, 'ruleFlags', 'rule_flags') ?? pricing?.rule_flags;
  if (!Array.isArray(source)) return [];
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Raw;
    const code = typeof row.code === 'string' ? row.code : null;
    if (!code) return [];
    const params =
      row.params && typeof row.params === 'object'
        ? (row.params as Record<string, string | number>)
        : {};
    return [{ code, severity: row.severity === 'hard' ? ('hard' as const) : ('soft' as const), params }];
  });
}

export function normalizeCustomerApplication(raw: Raw): CustomerApplication {
  const product = pick<Raw>(raw, 'product', 'product');
  const documents = pick<Raw[]>(raw, 'documents', 'documents');
  const schedules = pick<Raw[]>(raw, 'paymentSchedules', 'payment_schedules');
  const price = product ? pick<unknown>(product, 'price', 'price') : undefined;
  const identityHoldReason = pick<string | null>(raw, 'identityHoldReason', 'identity_hold_reason') ?? null;
  const takaful = pick<Raw[]>(raw, 'takafulPolicies', 'takaful_policies');
  const pricingSnapshot = pick<Record<string, unknown> | null>(raw, 'pricingSnapshot', 'pricing_snapshot') ?? null;
  const company = pick<Raw | null>(raw, 'company', 'company') ?? null;
  const financingSource = pick<string | null>(raw, 'financingSource', 'financing_source') ?? null;

  return {
    ...raw,
    id: String(raw.id),
    status: String(raw.status),
    createdAt: asIso(pick(raw, 'createdAt', 'created_at')),
    submittedAt: asNullableIso(pick(raw, 'submittedAt', 'submitted_at')),
    activatedAt: asNullableIso(pick(raw, 'activatedAt', 'activated_at')),
    completedAt: asNullableIso(pick(raw, 'completedAt', 'completed_at')),
    pricingSnapshot,
    installmentPlan: pick<InstallmentPlan | null>(raw, 'installmentPlan', 'installment_plan') ?? null,
    resubmissionComment: pick<string | null>(raw, 'resubmissionComment', 'resubmission_comment') ?? null,
    contractGenerated: Boolean(pick(raw, 'contractGenerated', 'contract_generated') ?? false),
    identityHold: identityHoldReason
      ? {
          reason: identityHoldReason,
          heldAt: asIso(pick(raw, 'identityHoldAt', 'identity_hold_at')),
          clearedAt: asNullableIso(pick(raw, 'identityHoldClearedAt', 'identity_hold_cleared_at')),
        }
      : null,
    consentsCompletedAt: asNullableIso(pick(raw, 'consentsCompletedAt', 'consents_completed_at')),
    lenderId: pick<string | null>(raw, 'financePartnerId', 'finance_partner_id') ?? null,
    lenderName: pick<string | null>(raw, 'financePartnerName', 'finance_partner_name') ?? null,
    financingSource: financingSource === 'partner' ? 'partner' : financingSource === 'blox' ? 'blox' : null,
    dealerName: company && typeof company.name === 'string' ? company.name : null,
    branchName: pick<string | null>(raw, 'branchName', 'branch_name') ?? null,
    ruleFlags: normalizeRuleFlags(raw, pricingSnapshot),
    customerSnapshot: pick<Record<string, unknown> | null>(raw, 'customerSnapshot', 'customer_snapshot') ?? null,
    takafulPolicies: takaful?.map(normalizeTakafulPolicy),
    product: product
      ? {
          ...product,
          make: product.make as string | undefined,
          model: product.model as string | undefined,
          slug: product.slug as string | undefined,
          modelYear: pick<number>(product, 'modelYear', 'model_year'),
          price: price == null ? undefined : Number(price),
        }
      : undefined,
    documents: documents?.map((doc) => ({
      ...doc,
      id: String(doc.id),
      category: String(doc.category),
      mimeType: pick<string | null>(doc, 'mimeType', 'mime_type') ?? null,
      originalName: pick<string | null>(doc, 'originalName', 'original_name') ?? null,
      kycDocumentType: pick<string | null>(doc, 'kycDocumentType', 'kyc_document_type') ?? null,
      verificationStatus: pick<string | null>(doc, 'verificationStatus', 'verification_status') ?? null,
      createdAt: asIso(pick(doc, 'createdAt', 'created_at')),
    })),
    paymentSchedules: schedules?.map((row) => ({
      ...row,
      id: String(row.id),
      sequence: Number(row.sequence),
      dueDate: asIso(pick(row, 'dueDate', 'due_date')),
      amount: row.amount as string | number,
      status: String(row.status),
      paidAmount: pick<number | null>(row, 'paidAmount', 'paid_amount') ?? null,
      remainingAmount: pick<number | null>(row, 'remainingAmount', 'remaining_amount') ?? null,
      paidAt: asNullableIso(pick(row, 'paidAt', 'paid_at')),
    })),
  };
}

export function normalizeCustomerApplicationList(res: { total: number; items: Raw[] }) {
  return { total: res.total, items: res.items.map(normalizeCustomerApplication) };
}

/** Vehicle label used by the dashboard hero, attention strip and detail facts. */
export function customerApplicationVehicleLabel(app: {
  product?: { make?: string; model?: string; modelYear?: number };
}): string {
  const p = app.product;
  if (!p) return '';
  return [p.make, p.model, p.modelYear].filter((part) => part != null && part !== '').join(' ');
}
