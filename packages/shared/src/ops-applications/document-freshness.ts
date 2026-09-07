/**
 * Document freshness — time-sensitive slots (salary certificate, bank
 * statements, guarantor salary, business bank) carry `maxAgeDays`. The API
 * returns the stale categories with the checklist and refuses submit with
 * `documents_stale`; this mirrors the rule locally so the badge is right even
 * before the checklist endpoint answers.
 */
import { slotSatisfiedBy } from './customer-info';

export type FreshnessDocument = { category: string; created_at?: string | null };
export type FreshnessSlot = { category: string; maxAgeDays?: number; uploaded_at?: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Newest upload for a category (`id` satisfies `qid`), or null when nothing is filed under it. */
export function newestUploadAt(category: string, documents: FreshnessDocument[]): string | null {
  let newest: string | null = null;
  for (const doc of documents) {
    if (!slotSatisfiedBy(category, [doc.category])) continue;
    if (!doc.created_at) continue;
    if (!newest || doc.created_at > newest) newest = doc.created_at;
  }
  return newest;
}

/** Whole days since the upload; null when the date is missing or invalid. */
export function documentAgeDays(uploadedAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!uploadedAt) return null;
  const at = new Date(uploadedAt).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.floor((now.getTime() - at) / DAY_MS);
}

export function isStaleUpload(
  uploadedAt: string | null | undefined,
  maxAgeDays: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!maxAgeDays || maxAgeDays <= 0) return false;
  const age = documentAgeDays(uploadedAt, now);
  return age != null && age > maxAgeDays;
}

/**
 * Categories that are out of date: the API's own list (when it sent one) plus
 * anything derived locally from the slot's `maxAgeDays` and the newest upload.
 */
export function staleDocumentCategories(input: {
  slots: FreshnessSlot[];
  documents: FreshnessDocument[];
  serverStale?: string[] | null;
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();
  const stale = new Set<string>(input.serverStale ?? []);
  for (const slot of input.slots) {
    if (!slot.maxAgeDays) continue;
    const uploadedAt = slot.uploaded_at ?? newestUploadAt(slot.category, input.documents);
    if (isStaleUpload(uploadedAt, slot.maxAgeDays, now)) stale.add(slot.category);
  }
  return [...stale];
}
