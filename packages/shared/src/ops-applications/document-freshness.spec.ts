import { describe, expect, it } from 'vitest';
import { documentAgeDays, isStaleUpload, newestUploadAt, staleDocumentCategories } from './document-freshness';

const NOW = new Date('2026-09-07T10:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('document freshness', () => {
  it('finds the newest upload per category and treats `id` as a Qatar ID', () => {
    const docs = [
      { category: 'salary', created_at: daysAgo(40) },
      { category: 'salary', created_at: daysAgo(5) },
      { category: 'id', created_at: daysAgo(2) },
    ];
    expect(newestUploadAt('salary', docs)).toBe(daysAgo(5));
    expect(newestUploadAt('qid', docs)).toBe(daysAgo(2));
    expect(newestUploadAt('bank', docs)).toBeNull();
  });

  it('measures age in whole days and flags uploads older than the slot allows', () => {
    expect(documentAgeDays(daysAgo(31), NOW)).toBe(31);
    expect(documentAgeDays('not-a-date', NOW)).toBeNull();
    expect(isStaleUpload(daysAgo(31), 30, NOW)).toBe(true);
    expect(isStaleUpload(daysAgo(30), 30, NOW)).toBe(false);
    expect(isStaleUpload(daysAgo(400), undefined, NOW)).toBe(false);
    expect(isStaleUpload(null, 30, NOW)).toBe(false);
  });

  it('unions the API list with what the slots and uploads imply', () => {
    const slots = [
      { category: 'salary', maxAgeDays: 30 },
      { category: 'bank', maxAgeDays: 30, uploaded_at: daysAgo(45) },
      { category: 'qid' },
      { category: 'guarantor_salary', maxAgeDays: 30 },
    ];
    const docs = [
      { category: 'salary', created_at: daysAgo(31) },
      { category: 'qid', created_at: daysAgo(400) },
      { category: 'guarantor_salary', created_at: daysAgo(3) },
    ];
    expect(staleDocumentCategories({ slots, documents: docs, serverStale: ['business_bank'], now: NOW }).sort()).toEqual([
      'bank',
      'business_bank',
      'salary',
    ]);
    expect(staleDocumentCategories({ slots, documents: [], now: NOW })).toEqual(['bank']);
  });
});
