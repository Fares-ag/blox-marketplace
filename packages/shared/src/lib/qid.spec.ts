import { describe, expect, it } from 'vitest';
import { dateOfBirthMatchesQid, parseIsoDateParts, parseQid } from './qid';
import { maskIban, maskPhone, maskQid } from './masking';
import { documentMatchesSlot, documentSlotsFor, missingDocumentCategories } from './document-slots';
import { missingConsents } from './consents';

const NOW = new Date('2026-09-07T00:00:00Z');

describe('qid parsing', () => {
  it('derives birth year, nationality and residency from a Qatar ID', () => {
    const qatari = parseQid('29063412345', NOW);
    expect(qatari.valid).toBe(true);
    expect(qatari.birthYear).toBe(1990);
    expect(qatari.nationalityCode).toBe('634');
    expect(qatari.nationality?.alpha2).toBe('QA');
    expect(qatari.residency).toBe('qatari');

    const expat = parseQid('30135600001', NOW);
    expect(expat.birthYear).toBe(2001);
    expect(expat.nationality?.en).toBe('India');
    expect(expat.residency).toBe('expat');
  });

  it('rejects malformed values with a reason', () => {
    expect(parseQid('1234').reason).toBe('length');
    expect(parseQid('2906341234a').reason).toBe('digits');
    expect(parseQid('19063412345').reason).toBe('century');
    expect(parseQid('39963412345', NOW).reason).toBe('year');
  });

  it('cross-checks the typed date of birth against the QID year', () => {
    expect(dateOfBirthMatchesQid('1990-02-10', '29063412345')).toBe(true);
    expect(dateOfBirthMatchesQid('1991-02-10', '29063412345')).toBe(false);
    expect(dateOfBirthMatchesQid(null, '29063412345')).toBeNull();
  });

  it('treats a date that is not a real ISO date as a mismatch, not as unknown', () => {
    // Reading the first four characters of "20001-02-10" yielded 2000 and
    // matched a QID encoding the year 2000, so a five-digit year sailed through.
    expect(dateOfBirthMatchesQid('19901-02-10', '29063412345')).toBe(false);
    expect(dateOfBirthMatchesQid('1990-02-30', '29063412345')).toBe(false);
    expect(dateOfBirthMatchesQid('1990-13-01', '29063412345')).toBe(false);
    expect(dateOfBirthMatchesQid('90-02-10', '29063412345')).toBe(false);
    // A stored timestamp is still a real date and must keep matching.
    expect(dateOfBirthMatchesQid('1990-02-10T00:00:00.000Z', '29063412345')).toBe(true);
  });

  it('parses only calendar-real ISO dates', () => {
    expect(parseIsoDateParts('1990-02-10')).toEqual({ year: 1990, month: 2, day: 10 });
    expect(parseIsoDateParts('20001-02-10')).toBeNull();
    expect(parseIsoDateParts('2001-02-29')).toBeNull();
    expect(parseIsoDateParts('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
  });
});

describe('masking', () => {
  it('masks identifiers the way the FSD shows them', () => {
    expect(maskQid('12345678901')).toBe('XXXXXXX8901');
    expect(maskPhone('+97455512345')).toBe('+974 XXXX X345');
    expect(maskPhone('55512345')).toBe('XXXX X345');
    expect(maskIban('QA58DOHB00001234567890ABCDEFG')).toBe(`QA${'X'.repeat(23)}DEFG`);
  });
});

describe('document slots', () => {
  it('requires a passport for expatriates and the business pack for the self-employed', () => {
    const expat = documentSlotsFor({ residency: 'expat', employmentType: 'private-local' });
    expect(expat.find((s) => s.category === 'passport')?.required).toBe(true);
    expect(expat.find((s) => s.category === 'salary')?.required).toBe(true);

    const self = documentSlotsFor({ residency: 'qatari', employmentType: 'self-employed' });
    expect(self.some((s) => s.category === 'salary')).toBe(false);
    expect(self.filter((s) => s.required).map((s) => s.category)).toEqual(['qid_front', 'qid_back', 'cr', 'trade_license', 'business_bank', 'bank']);
  });

  it('adds guarantor slots and accepts a generic id for the qid slot', () => {
    const withGuarantor = documentSlotsFor({ residency: 'qatari', employmentType: 'gov-or-semi-gov', hasGuarantor: true });
    expect(withGuarantor.filter((s) => s.group === 'guarantor')).toHaveLength(3);
    expect(missingDocumentCategories({ residency: 'qatari', employmentType: 'gov-or-semi-gov' }, ['id', 'salary'])).toEqual(['bank']);
  });

  it('matches QID uploads stored as category qid to front and back slots', () => {
    const combined = { category: 'qid', original_name: 'scan.jpg' };
    expect(documentMatchesSlot(combined, 'qid_front')).toBe(true);
    expect(documentMatchesSlot(combined, 'qid_back')).toBe(true);
    expect(documentMatchesSlot({ category: 'qid', kyc_document_type: 'qid_front' }, 'qid_back')).toBe(false);
    expect(documentMatchesSlot({ category: 'qid', kyc_document_type: 'qid_back' }, 'qid_back')).toBe(true);
  });
});

describe('consents', () => {
  it('treats outdated versions as missing', () => {
    expect(missingConsents([])).toHaveLength(4);
    expect(
      missingConsents([
        { code: 'credit_bureau', version: '2026-09-v1' },
        { code: 'terms', version: 'old' },
        { code: 'kyc_biometric', version: '2026-09-v1' },
        { code: 'aml', version: '2026-09-v1' },
      ]),
    ).toEqual(['terms']);
  });
});
