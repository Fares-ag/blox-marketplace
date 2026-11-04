import { describe, expect, it } from 'vitest';
import { dmyToIso, isoToDmy } from './date-utils';

describe('DD/MM/YYYY plan date', () => {
  it('converts a complete calendar date and rejects a partial month', () => {
    expect(isoToDmy('2026-11-03')).toBe('03/11/2026');
    expect(dmyToIso('03/11/2026')).toBe('2026-11-03');
    expect(dmyToIso('0')).toBeNull();
    expect(dmyToIso('03/0')).toBeNull();
    expect(dmyToIso('31/02/2026')).toBeNull();
  });
});
