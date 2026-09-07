/**
 * Typed wrappers over the customer application endpoints the stepper uses.
 * Everything goes through `apiFetch` so `/api/v1` normalisation, cookies and
 * the 401 handler behave exactly like the rest of the marketplace.
 */
import { ApiError, apiFetch, type DocumentSlot, type PricingSnapshot, type ProductRuleViolation } from '@drivemarket/shared';

export type ApplicationDraftDto = {
  id: string;
  status: string;
  /** Set by the API when `POST /api/applications` returned an existing draft. */
  resumed?: boolean;
  product_id?: string;
  offer_id?: string | null;
  customer_snapshot?: Record<string, unknown> | null;
  pricing_snapshot?: Record<string, unknown> | null;
  consents_completed_at?: string | null;
  identity_hold_reason?: string | null;
  identity_hold_cleared_at?: string | null;
  documents?: Array<{ id: string; category: string; original_name?: string | null; created_at?: string }>;
  product?: { slug?: string; make?: string; model?: string; model_year?: number };
};

export type MyApplicationListItem = {
  id: string;
  status: string;
  created_at: string;
  product?: { make: string; model: string; model_year: number; slug: string; price?: number };
};

export type DocumentSlotsDto = {
  slots: DocumentSlot[];
  uploaded: string[];
  missing: string[];
  /** Categories whose newest upload is older than the slot's `maxAgeDays` (wave 2). */
  stale?: string[];
  /** Newest upload per category, ISO timestamps (wave 2). */
  uploaded_at?: Record<string, string>;
};

export type CreateDraftBody = {
  productId: string;
  offerId: string;
  quoteToken?: string;
  customerSnapshot: Record<string, unknown>;
  pricingSnapshot: PricingSnapshot;
};

export type PatchDraftBody = {
  customerSnapshot?: Record<string, unknown>;
  pricingSnapshot?: PricingSnapshot;
  offerId?: string;
};

export function createDraft(body: CreateDraftBody, idempotencyKey: string) {
  return apiFetch<ApplicationDraftDto>(
    '/api/applications',
    { method: 'POST', body: JSON.stringify(body) },
    { idempotencyKey },
  );
}

export function patchDraft(id: string, body: PatchDraftBody) {
  return apiFetch<ApplicationDraftDto>(`/api/applications/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchDraftDetail(id: string) {
  return apiFetch<ApplicationDraftDto>(`/api/applications/${id}`);
}

export async function fetchMyApplications() {
  const res = await apiFetch<{ total: number; items: MyApplicationListItem[] }>('/api/applications/mine?limit=100');
  return res.items ?? [];
}

export function fetchDocumentSlots(id: string) {
  return apiFetch<DocumentSlotsDto>(`/api/applications/${id}/document-slots`);
}

export function uploadApplicationDocument(id: string, category: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  body.append('category', category);
  return apiFetch<unknown>(`/api/applications/${id}/documents`, { method: 'POST', body });
}

export function submitApplication(id: string) {
  return apiFetch<ApplicationDraftDto>(`/api/applications/${id}/submit`, { method: 'POST' });
}

export async function fetchBlockingApplicationId(): Promise<string | null> {
  try {
    const res = await apiFetch<{ blocking: boolean; application_id?: string | null; applicationId?: string | null }>(
      '/api/applications/blocking',
    );
    return res.application_id ?? res.applicationId ?? null;
  } catch {
    return null;
  }
}

export type UploadedDocumentsState = {
  uploaded: string[];
  names: Record<string, string>;
  /** Categories the API flagged as older than allowed (re-upload needed before submit). */
  stale: string[];
  /** Newest upload per category, ISO timestamps. */
  uploadedAt: Record<string, string>;
};

/** Uploaded categories, file names and freshness, tolerant of the slots endpoint being unavailable. */
export async function loadUploadedDocuments(id: string): Promise<UploadedDocumentsState> {
  const [slots, detail] = await Promise.allSettled([fetchDocumentSlots(id), fetchDraftDetail(id)]);
  const docs = detail.status === 'fulfilled' ? detail.value.documents ?? [] : [];
  const uploaded = new Set<string>(slots.status === 'fulfilled' ? slots.value.uploaded : docs.map((d) => d.category));
  if (uploaded.has('id')) uploaded.add('qid');
  const names: Record<string, string> = {};
  const uploadedAt: Record<string, string> = {};
  for (const doc of docs) {
    if (doc.original_name) names[doc.category] = doc.original_name;
    if (doc.created_at && (!uploadedAt[doc.category] || doc.created_at > uploadedAt[doc.category])) {
      uploadedAt[doc.category] = doc.created_at;
    }
  }
  if (slots.status === 'fulfilled' && slots.value.uploaded_at) {
    for (const [category, at] of Object.entries(slots.value.uploaded_at)) {
      if (typeof at === 'string' && at) uploadedAt[category] = at;
    }
  }
  if (uploadedAt.id && !uploadedAt.qid) uploadedAt.qid = uploadedAt.id;
  const stale = slots.status === 'fulfilled' && Array.isArray(slots.value.stale) ? slots.value.stale.filter((c): c is string => typeof c === 'string') : [];
  return { uploaded: [...uploaded], names, stale, uploadedAt };
}

export type ApplyErrorCode =
  | 'blocking_application'
  | 'product_rule_violation'
  | 'dob_qid_mismatch'
  | 'identity_hold'
  | 'consents_required'
  | 'documents_missing'
  | 'documents_stale'
  | 'guarantor_consent_required'
  | 'vehicle_identity_incomplete'
  | 'vehicle_age_rule'
  | 'listing_not_available'
  | 'validation_failed'
  | 'unknown';

const CODE_ALIASES: Record<string, ApplyErrorCode> = {
  blocking_application: 'blocking_application',
  blocking_application_exists: 'blocking_application',
  product_rule_violation: 'product_rule_violation',
  dob_qid_mismatch: 'dob_qid_mismatch',
  identity_hold: 'identity_hold',
  consents_required: 'consents_required',
  documents_missing: 'documents_missing',
  documents_incomplete: 'documents_missing',
  documents_stale: 'documents_stale',
  guarantor_consent_required: 'guarantor_consent_required',
  vehicle_identity_incomplete: 'vehicle_identity_incomplete',
  vehicle_age_rule: 'vehicle_age_rule',
  listing_not_available: 'listing_not_available',
  vehicle_unavailable: 'listing_not_available',
  validation_failed: 'validation_failed',
};

/**
 * Structured payload from the API error envelope (`ApiError.details`). Read
 * defensively so a build without the field simply yields null.
 */
export function apiErrorDetails(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof ApiError)) return null;
  const details = (error as ApiError & { details?: unknown }).details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
}

/** `409 blocking_application` → the application that blocks a new one. */
export function blockingApplicationIdFrom(error: unknown): string | null {
  const details = apiErrorDetails(error);
  const id = details?.application_id ?? details?.applicationId;
  return typeof id === 'string' && id ? id : null;
}

/** `409 documents_missing` → categories still required. */
export function missingDocumentsFrom(error: unknown): string[] {
  const details = apiErrorDetails(error);
  const missing = details?.missing;
  return Array.isArray(missing) ? missing.filter((x): x is string => typeof x === 'string') : [];
}

/** `409 documents_stale` → categories whose newest upload is too old. */
export function staleDocumentsFrom(error: unknown): string[] {
  const details = apiErrorDetails(error);
  const stale = details?.stale;
  return Array.isArray(stale) ? stale.filter((x): x is string => typeof x === 'string') : [];
}

function isRuleViolation(value: unknown): value is ProductRuleViolation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === 'string' && (v.severity === 'hard' || v.severity === 'soft');
}

/** `400 product_rule_violation` → the violations the server evaluated. */
export function ruleViolationsFrom(error: unknown): ProductRuleViolation[] {
  const details = apiErrorDetails(error);
  const violations = details?.violations;
  return Array.isArray(violations)
    ? violations.filter(isRuleViolation).map((v) => ({ ...v, params: v.params && typeof v.params === 'object' ? v.params : {} }))
    : [];
}

/** Normalise an API failure into the codes the stepper reacts to. */
export function applyErrorCode(error: unknown): ApplyErrorCode {
  if (error instanceof ApiError) {
    const candidates = [error.code ?? '', error.message ?? ''];
    for (const candidate of candidates) {
      const hit = CODE_ALIASES[candidate.trim()];
      if (hit) return hit;
    }
    for (const candidate of candidates) {
      for (const [alias, code] of Object.entries(CODE_ALIASES)) {
        if (candidate.includes(alias)) return code;
      }
    }
  }
  return 'unknown';
}
