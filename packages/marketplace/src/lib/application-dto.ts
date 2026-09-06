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

export type CustomerApplicationTakaful = {
  id: string;
  provider?: string | null;
  policyNumber?: string | null;
  coverageType?: string | null;
  expiresAt?: string | null;
  daysToExpiry?: number | null;
  status: string;
  declarationAcceptedAt?: string | null;
  hasDocument?: boolean;
};

export type CustomerApplication = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  pricingSnapshot?: Record<string, unknown> | null;
  rejectionReason?: string | null;
  resubmissionComment?: string | null;
  contractGenerated?: boolean;
  /** Identity-level dedup hold (QID on file with different name/DOB). */
  identityHold?: { reason: string; heldAt: string; clearedAt: string | null } | null;
  consentsCompletedAt?: string | null;
  lenderName?: string | null;
  branchName?: string | null;
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

export function normalizeCustomerApplication(raw: Raw): CustomerApplication {
  const product = pick<Raw>(raw, 'product', 'product');
  const documents = pick<Raw[]>(raw, 'documents', 'documents');
  const schedules = pick<Raw[]>(raw, 'paymentSchedules', 'payment_schedules');
  const price = product ? pick<unknown>(product, 'price', 'price') : undefined;
  const identityHoldReason = pick<string | null>(raw, 'identityHoldReason', 'identity_hold_reason') ?? null;
  const takaful = pick<Raw[]>(raw, 'takafulPolicies', 'takaful_policies');

  return {
    ...raw,
    id: String(raw.id),
    status: String(raw.status),
    createdAt: asIso(pick(raw, 'createdAt', 'created_at')),
    submittedAt: asNullableIso(pick(raw, 'submittedAt', 'submitted_at')),
    activatedAt: asNullableIso(pick(raw, 'activatedAt', 'activated_at')),
    completedAt: asNullableIso(pick(raw, 'completedAt', 'completed_at')),
    pricingSnapshot: pick<Record<string, unknown> | null>(raw, 'pricingSnapshot', 'pricing_snapshot') ?? null,
    rejectionReason: pick<string | null>(raw, 'rejectionReason', 'rejection_reason') ?? null,
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
    lenderName: pick<string | null>(raw, 'financePartnerName', 'finance_partner_name') ?? null,
    branchName: pick<string | null>(raw, 'branchName', 'branch_name') ?? null,
    customerSnapshot: pick<Record<string, unknown> | null>(raw, 'customerSnapshot', 'customer_snapshot') ?? null,
    takafulPolicies: takaful?.map((p) => ({
      id: String(p.id),
      provider: (p.provider as string | null) ?? null,
      policyNumber: pick<string | null>(p, 'policyNumber', 'policy_number') ?? null,
      coverageType: pick<string | null>(p, 'coverageType', 'coverage_type') ?? null,
      expiresAt: asNullableIso(pick(p, 'expiresAt', 'expires_at')),
      daysToExpiry: pick<number | null>(p, 'daysToExpiry', 'days_to_expiry') ?? null,
      status: String(p.status ?? 'declared'),
      declarationAcceptedAt: asNullableIso(pick(p, 'declarationAcceptedAt', 'declaration_accepted_at')),
      hasDocument: Boolean(pick(p, 'hasDocument', 'has_document') ?? false),
    })),
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
