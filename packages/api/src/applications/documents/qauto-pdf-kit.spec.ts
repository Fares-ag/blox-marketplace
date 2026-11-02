import { describe, expect, it } from 'vitest';
import type { ContractFieldContext } from './field-maps';
import {
  employmentTenure,
  identityDocumentsOf,
  isoToDisplay,
  nationalAddressOf,
  nationalityOf,
  phoneLocal,
  qatarDate,
} from './qauto-pdf-kit';
import type { CustomerSnapshot } from '../customer-snapshot';

const snap = (extra: Record<string, unknown>): CustomerSnapshot =>
  ({ full_name: 'A', phone: '', qid: '', applicantType: 'individual', ...extra }) as CustomerSnapshot;

describe('qauto-pdf-kit', () => {
  it('formats contract dates in Qatar time, not the server zone', () => {
    // 22:30 UTC on 31 Oct is already 1 Nov in Doha.
    expect(qatarDate(new Date('2026-10-31T22:30:00Z'))).toBe('01/11/2026');
  });

  it('formats ISO schedule dates without timezone drift', () => {
    expect(isoToDisplay('2027-03-05')).toBe('05/03/2027');
    expect(isoToDisplay('15/11/2029')).toBe('15/11/2029');
  });

  it('writes Qatar mobiles as the 8 local digits', () => {
    expect(phoneLocal('+974 5580 8586')).toBe('55808586');
    expect(phoneLocal('0097455808586')).toBe('55808586');
    expect(phoneLocal('55808586')).toBe('55808586');
  });

  it('reads national address numbers from labelled free text and de-duplicates the area', () => {
    const address = nationalAddressOf(
      snap({ address: { line1: 'Bldg 62, Street 903, Al Sadd', area: 'Al Sadd', zone: '38', city: 'Doha', poBox: '8044' } }),
    );
    expect(address).toMatchObject({ buildingNo: '62', streetNo: '903', zone: '38', poBox: '8044' });
    expect(address.streetName).toBe('Bldg 62, Street 903, Al Sadd');
    expect(address.full).toBe('Bldg 62, Street 903, Al Sadd, Doha, Zone 38, Qatar');
  });

  it('keeps explicit legacy building / street numbers', () => {
    const address = nationalAddressOf(snap({ address: { building: '62', street: '903', zone: '31' } }));
    expect(address).toMatchObject({ buildingNo: '62', streetNo: '903', zone: '31', streetName: '' });
  });

  it('turns the stored employment duration code into words', () => {
    expect(employmentTenure({ employmentDuration: 'more-than-12-months' })).toBe('More than 12 months');
    expect(employmentTenure({ startDate: '2014-12-15', employmentDuration: 'more-than-12-months' })).toBe('15/12/2014');
  });

  it('derives nationality from the QID when none was typed', () => {
    expect(nationalityOf({ qid: '27863400155' })).toBe('Qatar');
    expect(nationalityOf({ nationality: 'Egypt', qid: '27863400155' })).toBe('Egypt');
  });

  it('takes passport and QID expiry from the snapshot, else from the eKYC extraction', () => {
    const ctx = {
      kyc: {
        extracted_identity: [
          { name: 'document_number', label: 'Document number', value: 'A41196196', document_type: 'passport' },
          { name: 'expiration_date', label: 'Expiry', value: '2032-04-04', document_type: 'passport' },
          { name: 'expiration_date', label: 'Expiry', value: '2029-11-15', document_type: 'qid' },
        ],
      },
    } as unknown as ContractFieldContext;
    expect(identityDocumentsOf(ctx, snap({}))).toEqual({
      passportNo: 'A41196196',
      passportExpiry: '04/04/2032',
      qidExpiry: '15/11/2029',
    });
    expect(identityDocumentsOf(ctx, snap({ passportNumber: 'B1', qidExpiry: '2030-01-01' }))).toMatchObject({
      passportNo: 'B1',
      qidExpiry: '01/01/2030',
    });
  });
});
