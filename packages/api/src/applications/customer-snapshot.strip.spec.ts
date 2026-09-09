import { describe, expect, it } from 'vitest';
import { stripUndefinedDeep } from './customer-snapshot';

/** Mimics what class-transformer hands the service: declared-but-omitted fields exist as undefined. */
class SnapshotLike {
  full_name?: string = 'Demo Customer';
  city?: string = undefined;
  address?: AddressLike = undefined;
  employment?: EmploymentLike;
}
class AddressLike {
  line1?: string = 'Street 1';
  area?: string = undefined;
}
class EmploymentLike {
  company?: string = 'Blox';
  jobTitle?: string = undefined;
}

describe('stripUndefinedDeep', () => {
  it('drops omitted fields so a partial save cannot blank stored data', () => {
    const stored = { full_name: 'Demo Customer', city: 'Doha', monthlyIncome: 15000 };
    const patch = new SnapshotLike();
    patch.employment = new EmploymentLike();

    const merged = { ...stored, ...stripUndefinedDeep(patch as Record<string, unknown>) };

    expect(merged.city).toBe('Doha');
    expect(merged.monthlyIncome).toBe(15000);
    expect(merged.full_name).toBe('Demo Customer');
    expect('address' in merged).toBe(false);
  });

  it('strips nested DTO instances too, keeping the values that were sent', () => {
    const patch = new SnapshotLike();
    patch.address = new AddressLike();
    const out = stripUndefinedDeep(patch as Record<string, unknown>) as Record<string, unknown>;
    expect(out.address).toEqual({ line1: 'Street 1' });
    expect(Object.keys(out)).toEqual(['full_name', 'address']);
  });

  it('keeps falsy values, arrays and dates intact', () => {
    const date = new Date('2026-09-07T00:00:00Z');
    const out = stripUndefinedDeep({
      zero: 0,
      empty: '',
      no: false,
      nothing: null,
      gone: undefined,
      list: [{ keep: 1, drop: undefined }],
      date,
    }) as Record<string, unknown>;
    expect(out).toEqual({ zero: 0, empty: '', no: false, nothing: null, list: [{ keep: 1 }], date });
    expect(out.date).toBe(date);
  });
});
