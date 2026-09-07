import type { CustomerDocument, CustomerDocumentCategory } from '@prisma/client';
import type { CustomerDocumentDto } from '../../../shared/src/types/customer-platform';

/** A document within this many days of expiry is "expiring soon" (vault badges and the first reminder). */
export const VAULT_EXPIRING_SOON_DAYS = 60;

const DAY_MS = 86_400_000;

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whole days from `from` to `to`, both truncated to UTC dates (negative when `to` is in the past). */
export function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}

export function daysToExpiry(expiresAt: Date | null | undefined, now: Date = new Date()): number | null {
  return expiresAt ? daysBetweenUtc(now, expiresAt) : null;
}

export type ExpiryState = CustomerDocumentDto['expiry_state'];

/** none (no expiry recorded) | expired (past) | expiring_soon (≤ 60 days, today included) | valid. */
export function expiryState(days: number | null, soonDays: number = VAULT_EXPIRING_SOON_DAYS): ExpiryState {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'expiring_soon';
  return 'valid';
}

/** 'XXXX' + last four characters: recognisable to the owner, useless to anyone else. */
export function maskDocumentNumber(plain: string | null | undefined): string | null {
  const value = String(plain ?? '').replace(/\s+/g, '');
  if (!value) return null;
  return `XXXX${value.slice(-4)}`;
}

export const CUSTOMER_DOCUMENT_LABELS: Record<CustomerDocumentCategory, string> = {
  qid_front: 'Qatar ID (front)',
  qid_back: 'Qatar ID (back)',
  passport: 'passport',
  driving_licence: 'driving licence',
  residence_proof: 'proof of residence',
  salary_certificate: 'salary certificate',
  bank_statement: 'bank statement',
  other: 'document',
};

export function toCustomerDocumentDto(
  doc: CustomerDocument,
  documentNumber: string | null,
  now: Date = new Date(),
): CustomerDocumentDto {
  const days = daysToExpiry(doc.expiresAt, now);
  return {
    id: doc.id,
    category: doc.category,
    original_name: doc.originalName ?? null,
    mime_type: doc.mimeType ?? 'application/octet-stream',
    size_bytes: doc.sizeBytes ?? 0,
    document_number_masked: maskDocumentNumber(documentNumber),
    issued_at: doc.issuedAt ? doc.issuedAt.toISOString().slice(0, 10) : null,
    expires_at: doc.expiresAt ? doc.expiresAt.toISOString().slice(0, 10) : null,
    days_to_expiry: days,
    expiry_state: expiryState(days),
    verified_at: doc.verifiedAt?.toISOString() ?? null,
    created_at: doc.createdAt.toISOString(),
  };
}
