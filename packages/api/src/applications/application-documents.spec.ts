import { describe, expect, it } from 'vitest';
import {
  hasAllRequiredDocuments,
  missingRequiredDocumentCategories,
  REQUIRED_APPLICATION_DOC_CATEGORIES,
} from './application-documents';

describe('application-documents', () => {
  it('requires all four categories', () => {
    expect(REQUIRED_APPLICATION_DOC_CATEGORIES).toEqual(['qid', 'salary', 'bank', 'other']);
  });

  it('detects missing categories', () => {
    expect(missingRequiredDocumentCategories([{ category: 'qid' }, { category: 'salary' }])).toEqual([
      'bank',
      'other',
    ]);
  });

  it('passes when all categories present', () => {
    const docs = REQUIRED_APPLICATION_DOC_CATEGORIES.map((category) => ({ category }));
    expect(hasAllRequiredDocuments(docs)).toBe(true);
    expect(missingRequiredDocumentCategories(docs)).toEqual([]);
  });

  it('fails when any category missing', () => {
    expect(hasAllRequiredDocuments([])).toBe(false);
  });
});
