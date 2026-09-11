import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  birthYearOf,
  employmentTypeOf,
  hasGuarantorOf,
  isoDateOnly,
  normalizeCustomerSnapshot,
  normalizePersonName,
  readCustomerSnapshot,
  residencyOf,
} from './customer-snapshot';

const QATARI_QID = '28563412345'; // born 1985, nationality 634 (Qatar)
const EXPAT_QID = '29035612345'; // born 1990, nationality 356 (India)

describe('normalizeCustomerSnapshot', () => {
  it('derives residency and nationality from the Qatar ID', () => {
    const qatari = normalizeCustomerSnapshot({ full_name: 'Ahmed', phone: '+97455512345', qid: QATARI_QID });
    expect(qatari.residency).toBe('qatari');
    expect(qatari.snapshot.residency).toBe('qatari');
    expect(qatari.snapshot.nationality).toBe('Qatar');
    expect(qatari.birthYear).toBe(1985);

    const expat = normalizeCustomerSnapshot({
      full_name: 'Priya',
      phone: '55512345',
      qid: EXPAT_QID,
      nationality: 'Egyptian',
      residency: 'qatari',
    });
    expect(expat.residency).toBe('expat');
    expect(expat.snapshot.nationality).toBe('India');
    expect(expat.snapshot.residency).toBe('expat');
  });

  it('builds full_name from first and last name and lower-cases the email', () => {
    const out = normalizeCustomerSnapshot({
      firstName: ' Ahmed ',
      lastName: 'Al-Thani',
      phone: '+97455512345',
      qid: QATARI_QID,
      email: 'Ahmed@Example.COM',
    });
    expect(out.snapshot.full_name).toBe('Ahmed Al-Thani');
    expect(out.snapshot.email).toBe('ahmed@example.com');
    expect(out.profile).toEqual({ firstName: 'Ahmed', lastName: 'Al-Thani', nationality: 'Qatar' });
  });

  it('rejects a date of birth that disagrees with the QID birth year', () => {
    expect(() =>
      normalizeCustomerSnapshot({
        full_name: 'Ahmed',
        phone: '+97455512345',
        qid: QATARI_QID,
        dateOfBirth: '1990-01-01',
      }),
    ).toThrow('dob_qid_mismatch');
  });

  it('accepts a matching date of birth and mirrors it to the profile', () => {
    const out = normalizeCustomerSnapshot({
      full_name: 'Ahmed',
      phone: '+97455512345',
      qid: QATARI_QID,
      dateOfBirth: '1985-06-15',
      gender: 'male',
    });
    expect(out.snapshot.dateOfBirth).toBe('1985-06-15');
    expect(out.birthYear).toBe(1985);
    expect(out.profile.dateOfBirth?.toISOString()).toBe('1985-06-15T00:00:00.000Z');
    expect(out.profile.gender).toBe('male');
  });

  it('rejects an unparsable date of birth', () => {
    expect(() =>
      normalizeCustomerSnapshot({ full_name: 'A', phone: '1', qid: QATARI_QID, dateOfBirth: '2024-02-30' }),
    ).toThrow(BadRequestException);
  });

  it('requires name, phone and QID unless told otherwise', () => {
    expect(() => normalizeCustomerSnapshot({ full_name: 'A', phone: '1' })).toThrow('validation_failed');
    const partial = normalizeCustomerSnapshot({ monthlyIncome: '12000' }, { requireContact: false });
    expect(partial.snapshot.monthlyIncome).toBe(12000);
    expect(partial.parsedQid.valid).toBe(false);
  });

  it('keeps a non-QID identity number verbatim and falls back to the nationality text', () => {
    const out = normalizeCustomerSnapshot({
      full_name: 'A',
      phone: '1',
      qid: 'P1234567',
      nationality: 'Egypt',
    });
    expect(out.snapshot.qid).toBe('P1234567');
    expect(out.residency).toBe('expat');
  });

  it('normalises the guarantor block and derives hasGuarantor', () => {
    const withGuarantor = normalizeCustomerSnapshot({
      full_name: 'A',
      phone: '1',
      qid: EXPAT_QID,
      guarantor: { fullName: ' Ali ', qid: '2856 3412 345', phone: '5555', relationship: 'sibling', monthlyIncome: '9000' },
    });
    expect(withGuarantor.snapshot.hasGuarantor).toBe(true);
    expect(withGuarantor.snapshot.guarantor).toEqual({
      fullName: 'Ali',
      qid: QATARI_QID,
      phone: '5555',
      relationship: 'sibling',
      monthlyIncome: 9000,
    });

    const declined = normalizeCustomerSnapshot({
      full_name: 'A',
      phone: '1',
      qid: EXPAT_QID,
      hasGuarantor: false,
      guarantor: { fullName: 'Stale' },
    });
    expect(declined.snapshot.hasGuarantor).toBe(false);
    expect(declined.snapshot.guarantor).toBeUndefined();
  });

  it('drops invalid enum values and preserves unknown keys', () => {
    const out = normalizeCustomerSnapshot({
      full_name: 'A',
      phone: '1',
      qid: EXPAT_QID,
      gender: 'other',
      residenceDuration: 'forever',
      corporate: { crNumber: '123' },
      employmentDetails: { employer: 'X' },
    });
    expect(out.snapshot.gender).toBeUndefined();
    expect(out.snapshot.residenceDuration).toBeUndefined();
    expect(out.snapshot.corporate).toEqual({ crNumber: '123' });
    expect(out.snapshot.employmentDetails).toEqual({ employer: 'X' });
    expect(out.snapshot.applicantType).toBe('individual');
  });

  it('normalises and validates corporate registration and signatory fields', () => {
    const out = normalizeCustomerSnapshot({
      applicantType: 'corporate',
      full_name: 'Doha Motors WLL',
      phone: '+97455512345',
      qid: QATARI_QID,
      corporate: {
        crNumber: 'CR-12 345',
        authorizedSignatory: { phone: '+974 5551 2345', qid: QATARI_QID },
      },
    });
    expect(out.snapshot.corporate).toMatchObject({
      crNumber: '12345',
      authorizedSignatory: { qid: QATARI_QID, nationality: 'Qatar', phone: '+974 5551 2345' },
    });

    expect(() =>
      normalizeCustomerSnapshot({
        applicantType: 'corporate',
        full_name: 'Doha Motors WLL',
        phone: '+97455512345',
        qid: QATARI_QID,
        corporate: { crNumber: 'abc', authorizedSignatory: { phone: '+97455512345', qid: QATARI_QID } },
      }),
    ).toThrow('validation_failed');
  });
});

describe('snapshot readers', () => {
  it('readCustomerSnapshot tolerates garbage', () => {
    expect(readCustomerSnapshot(null)).toEqual({ full_name: '', phone: '', qid: '', applicantType: 'individual' });
    expect(readCustomerSnapshot({ applicantType: 'corporate', qid: 5 }).applicantType).toBe('corporate');
  });

  it('employmentTypeOf reads object, string and dealer employmentDetails shapes', () => {
    expect(employmentTypeOf({ employment: { employmentType: 'self-employed' } })).toBe('self-employed');
    expect(employmentTypeOf({ employment: 'gov-or-semi-gov' })).toBe('gov-or-semi-gov');
    expect(employmentTypeOf({ employmentDetails: { employmentType: 'private-local' } })).toBe('private-local');
    expect(employmentTypeOf({})).toBeNull();
  });

  it('residencyOf / birthYearOf / hasGuarantorOf derive from stored snapshots', () => {
    expect(residencyOf({ qid: QATARI_QID })).toBe('qatari');
    expect(residencyOf({ qid: 'bad', residency: 'expat' })).toBe('expat');
    expect(residencyOf({ nationality: 'Qatar' })).toBe('qatari');
    expect(birthYearOf({ qid: EXPAT_QID })).toBe(1990);
    expect(birthYearOf({ qid: EXPAT_QID, dateOfBirth: '1991-02-02' })).toBe(1991);
    expect(hasGuarantorOf({ guarantor: { qid: QATARI_QID } })).toBe(true);
    expect(hasGuarantorOf({ hasGuarantor: false, guarantor: { qid: QATARI_QID } })).toBe(false);
  });

  it('isoDateOnly validates real calendar dates', () => {
    expect(isoDateOnly('1985-06-15T10:00:00Z')).toBe('1985-06-15');
    expect(isoDateOnly(new Date('1985-06-15T00:00:00.000Z'))).toBe('1985-06-15');
    expect(isoDateOnly('1985-13-01')).toBeNull();
    expect(isoDateOnly('yesterday')).toBeNull();
  });

  it('normalizePersonName folds case, diacritics and punctuation', () => {
    expect(normalizePersonName('  Mohammed   AL-Thani ')).toBe('mohammed al thani');
    expect(normalizePersonName('José Núñez')).toBe('jose nunez');
    expect(normalizePersonName(null)).toBe('');
  });
});
