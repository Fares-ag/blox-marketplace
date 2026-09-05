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
