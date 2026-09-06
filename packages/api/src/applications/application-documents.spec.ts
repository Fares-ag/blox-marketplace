import { describe, expect, it } from 'vitest';
import {
  hasAllRequiredDocuments,
  missingRequiredDocumentCategories,
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
