import { describe, expect, it } from 'vitest';
import {
  documentSlotsForApplication,
  hasAllRequiredDocuments,
  isSlotStale,
  missingRequiredDocumentCategories,
  newestUploadByCategory,
  staleDocumentCategories,
  uploadedDocumentCategories,
} from './application-documents';

describe('application-documents', () => {
  it('requires qid, salary, and bank', () => {
    expect(missingRequiredDocumentCategories([])).toEqual(['qid', 'salary', 'bank']);
  });

  it('treats legacy id category as qid', () => {
    expect(
      hasAllRequiredDocuments([
        { category: 'id' },
        { category: 'salary' },
        { category: 'bank' },
      ]),
    ).toBe(true);
  });

  it('accepts verified KYC QID slots without a separate qid row yet', () => {
    expect(
      hasAllRequiredDocuments([
        {
          category: 'qid',
          kycDocumentType: 'qid_front',
          verificationStatus: 'verified',
        },
        {
          category: 'qid',
          kycDocumentType: 'qid_back',
          verificationStatus: 'verified',
        },
        { category: 'salary' },
        { category: 'bank' },
      ]),
    ).toBe(true);
  });

  it('accepts manual qid_front and qid_back uploads', () => {
    expect(
      hasAllRequiredDocuments([
        { category: 'qid', kycDocumentType: 'qid_front' },
        { category: 'qid', kycDocumentType: 'qid_back' },
        { category: 'salary' },
        { category: 'bank' },
      ]),
    ).toBe(true);
  });

  it('accepts Didit-style single-sided QID when back slot is absent', () => {
    expect(
      hasAllRequiredDocuments([
        {
          category: 'qid',
          kycDocumentType: 'qid_front',
          verificationStatus: 'verified',
        },
        { category: 'salary' },
        { category: 'bank' },
      ]),
    ).toBe(true);
  });
});

describe('document freshness', () => {
  const NOW = new Date('2026-09-07T12:00:00.000Z');
  const DAY = 86_400_000;
  const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
  /** Expat salaried applicant: salary certificate and bank statement carry a 30-day max age. */
  const EXPAT = {
    full_name: 'Priya Nair',
    phone: '+97455512345',
    qid: '29035612345',
    applicantType: 'individual',
    employment: { employmentType: 'private-local' },
  };

  it('keeps the newest upload per category and lets `id` count for `qid`', () => {
    const newest = newestUploadByCategory([
      { category: 'bank', createdAt: ago(40) },
      { category: 'bank', createdAt: ago(5) },
      { category: 'id', createdAt: ago(200) },
      { category: 'salary' },
    ]);
    expect(newest.get('bank')).toBe(ago(5).getTime());
    expect(newest.get('qid')).toBe(ago(200).getTime());
    expect(newest.has('salary')).toBe(false);
  });

  it('judges staleness against the slot max age only when there is an upload', () => {
    expect(isSlotStale({ maxAgeDays: 30 }, ago(31).getTime(), NOW)).toBe(true);
    expect(isSlotStale({ maxAgeDays: 30 }, ago(29).getTime(), NOW)).toBe(false);
    expect(isSlotStale({ maxAgeDays: 30 }, null, NOW)).toBe(false);
    expect(isSlotStale({}, ago(400).getTime(), NOW)).toBe(false);
  });

  it('lists the stale time-sensitive categories for the applicant profile', () => {
    expect(
      staleDocumentCategories(
        EXPAT,
        [
          { category: 'qid', createdAt: ago(400) },
          { category: 'passport', createdAt: ago(400) },
          { category: 'salary', createdAt: ago(45) },
          { category: 'bank', createdAt: ago(10) },
        ],
        NOW,
      ),
    ).toEqual(['salary']);
    expect(
      staleDocumentCategories(
        { ...EXPAT, employment: { employmentType: 'self-employed' } },
        [
          { category: 'business_bank', createdAt: ago(31) },
          { category: 'bank', createdAt: ago(31) },
        ],
        NOW,
      ),
    ).toEqual(['business_bank', 'bank']);
    expect(
      staleDocumentCategories({ ...EXPAT, applicantType: 'corporate' }, [{ category: 'salary', createdAt: ago(31) }], NOW),
    ).toEqual(['salary']);
  });

  it('adds `stale` and per-slot `uploaded_at` to the document-slots response', () => {
    const dto = documentSlotsForApplication(
      EXPAT,
      [
        { category: 'qid', createdAt: ago(3) },
        { category: 'salary', createdAt: ago(45) },
        { category: 'salary', createdAt: ago(60) },
      ],
      NOW,
    );
    expect(dto.stale).toEqual(['salary']);
    expect(dto.missing).toEqual(['passport', 'bank']);
    expect(dto.uploaded).toEqual(['qid', 'qid_back', 'qid_front', 'salary']);
    const byCategory = new Map(dto.slots.map((slot) => [slot.category, slot]));
    expect(byCategory.get('salary')?.uploaded_at).toBe(ago(45).toISOString());
    expect(byCategory.get('qid_front')?.uploaded_at).toBe(ago(3).toISOString());
    expect(byCategory.get('qid_back')?.uploaded_at).toBe(ago(3).toISOString());
    expect(byCategory.get('bank')?.uploaded_at).toBeNull();
    expect(byCategory.get('salary')?.maxAgeDays).toBe(30);
  });

  describe('e-KYC identity policy (BRD BR-3)', () => {
    const EKYC = { ekycRequired: true };
    const rest = [{ category: 'salary' }, { category: 'bank' }];

    it('rejects a customer-uploaded manual QID when e-KYC is required', () => {
      const docs = [{ category: 'qid', uploadedByRole: 'customer' }, ...rest];
      expect(missingRequiredDocumentCategories(docs, EKYC)).toEqual(['qid']);
      expect(uploadedDocumentCategories(docs, EKYC)).toEqual(['bank', 'salary']);
      expect(hasAllRequiredDocuments(docs)).toBe(true); // legacy policy unchanged
    });

    it('rejects a legacy id upload with no uploader role under e-KYC', () => {
      expect(hasAllRequiredDocuments([{ category: 'id' }, ...rest], EKYC)).toBe(false);
    });

    it('accepts a staff-uploaded QID (face-to-face intake) unless disabled', () => {
      const docs = [{ category: 'qid', uploadedByRole: 'dealer_agent' }, ...rest];
      expect(hasAllRequiredDocuments(docs, EKYC)).toBe(true);
      expect(hasAllRequiredDocuments(docs, { ...EKYC, allowStaffManualIdentity: false })).toBe(false);
    });

    it('still accepts verified KYC-platform identity slots', () => {
      const docs = [
        { category: 'qid', kycDocumentType: 'qid_front', verificationStatus: 'verified', uploadedByRole: 'customer' },
        ...rest,
      ];
      expect(hasAllRequiredDocuments(docs, { ...EKYC, allowStaffManualIdentity: false })).toBe(true);
    });

    it('does not count an unverified KYC slot', () => {
      const docs = [{ category: 'qid', kycDocumentType: 'qid_front', verificationStatus: 'processing' }, ...rest];
      expect(hasAllRequiredDocuments(docs, EKYC)).toBe(false);
    });
  });
});
