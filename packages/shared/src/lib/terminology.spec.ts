import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales';
import { featureEn } from '../i18n/features';
import { findForbiddenTerms, findForbiddenTermsInObject } from './terminology';

describe('Shariah terminology guard', () => {
  it('flags interest, APR and late-charge wording but allows "interested in"', () => {
    expect(findForbiddenTerms('Annual percentage rate (APR): 12%').map((h) => h.term)).toEqual([
      'annual percentage rate',
      'APR',
    ]);
    expect(findForbiddenTerms('A late payment fee applies.').length).toBe(1);
    expect(findForbiddenTerms('If you are interested in this vehicle').length).toBe(0);
    expect(findForbiddenTerms('Monthly rent on the Blox share').length).toBe(0);
  });

  it('keeps every English UI string free of forbidden terms', () => {
    const hits = [...findForbiddenTermsInObject(en, ['en']), ...findForbiddenTermsInObject(featureEn, ['features'])];
    expect(hits.map((h) => `${h.path}: ${h.hit.context}`)).toEqual([]);
  });
});
