import { describe, expect, it } from 'vitest';
import type { CustomerDocument } from '@prisma/client';
import {
  daysBetweenUtc,
  daysToExpiry,
  expiryState,
  maskDocumentNumber,
  toCustomerDocumentDto,
  VAULT_EXPIRING_SOON_DAYS,
} from './vault-logic';

const NOW = new Date('2026-09-07T13:45:00Z');

function doc(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    id: 'doc-1',
    userId: 'user-1',
    category: 'qid_front',
    storagePath: 'vault/user-1/qid_front/abc.pdf',
    mimeType: 'application/pdf',
    originalName: 'qid.pdf',
    sizeBytes: 1234,
    documentNumberEnc: 'v1:enc',
    issuedAt: new Date('2024-01-15T00:00:00Z'),
    expiresAt: new Date('2026-10-01T00:00:00Z'),
    verifiedAt: null,
    verifiedById: null,
    lastReminderKind: null,
    lastReminderAt: null,
    deletedAt: null,
    createdAt: new Date('2026-09-01T09:00:00Z'),
    updatedAt: new Date('2026-09-01T09:00:00Z'),
    ...overrides,
  };
}

describe('daysToExpiry', () => {
  it('counts whole UTC days regardless of the time of day', () => {
    expect(daysBetweenUtc(NOW, new Date('2026-09-07T00:00:00Z'))).toBe(0);
    expect(daysBetweenUtc(NOW, new Date('2026-09-08T00:00:00Z'))).toBe(1);
    expect(daysBetweenUtc(NOW, new Date('2026-09-06T23:59:59Z'))).toBe(-1);
    expect(daysToExpiry(new Date('2026-11-06T00:00:00Z'), NOW)).toBe(60);
  });

  it('is null without an expiry date', () => {
    expect(daysToExpiry(null, NOW)).toBeNull();
    expect(daysToExpiry(undefined, NOW)).toBeNull();
  });
});

describe('expiryState', () => {
  it('maps day counts onto the four states', () => {
    expect(expiryState(null)).toBe('none');
    expect(expiryState(-1)).toBe('expired');
    expect(expiryState(0)).toBe('expiring_soon');
    expect(expiryState(VAULT_EXPIRING_SOON_DAYS)).toBe('expiring_soon');
    expect(expiryState(VAULT_EXPIRING_SOON_DAYS + 1)).toBe('valid');
    expect(expiryState(365)).toBe('valid');
  });
});

describe('maskDocumentNumber', () => {
  it('keeps only the last four characters', () => {
    expect(maskDocumentNumber('28412345678')).toBe('XXXX5678');
    expect(maskDocumentNumber('AB 123 456')).toBe('XXXX3456');
    expect(maskDocumentNumber('12')).toBe('XXXX12');
  });

  it('is null for missing numbers', () => {
    expect(maskDocumentNumber('')).toBeNull();
    expect(maskDocumentNumber(null)).toBeNull();
    expect(maskDocumentNumber(undefined)).toBeNull();
  });
});

describe('toCustomerDocumentDto', () => {
  it('maps a document with an upcoming expiry', () => {
    const dto = toCustomerDocumentDto(doc(), '28412345678', NOW);
    expect(dto).toEqual({
      id: 'doc-1',
      category: 'qid_front',
      original_name: 'qid.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1234,
      document_number_masked: 'XXXX5678',
      issued_at: '2024-01-15',
      expires_at: '2026-10-01',
      days_to_expiry: 24,
      expiry_state: 'expiring_soon',
      verified_at: null,
      created_at: '2026-09-01T09:00:00.000Z',
    });
  });

  it('reports expired and none states and tolerates missing metadata', () => {
    const expired = toCustomerDocumentDto(doc({ expiresAt: new Date('2026-09-01T00:00:00Z') }), null, NOW);
    expect(expired.days_to_expiry).toBe(-6);
    expect(expired.expiry_state).toBe('expired');
    expect(expired.document_number_masked).toBeNull();

    const none = toCustomerDocumentDto(
      doc({ expiresAt: null, issuedAt: null, mimeType: null, sizeBytes: null, originalName: null }),
      null,
      NOW,
    );
    expect(none.expiry_state).toBe('none');
    expect(none.days_to_expiry).toBeNull();
    expect(none.mime_type).toBe('application/octet-stream');
    expect(none.size_bytes).toBe(0);
    expect(none.original_name).toBeNull();
    expect(none.issued_at).toBeNull();
  });

  it('exposes the verification timestamp', () => {
    const dto = toCustomerDocumentDto(doc({ verifiedAt: new Date('2026-09-02T08:00:00Z') }), null, NOW);
    expect(dto.verified_at).toBe('2026-09-02T08:00:00.000Z');
  });
});
