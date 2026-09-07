import { describe, expect, it } from 'vitest';
import { FALLBACK_LENDER_NAME, resolveLenderOfRecord } from './lender-of-record';

describe('lender of record', () => {
  it('prefers the partner tagged on the application', () => {
    expect(
      resolveLenderOfRecord({
        taggedPartnerName: 'Al Jazeera Finance',
        offerPartnerName: 'Offer Partner',
        defaultLenderName: 'Default Lender',
        configuredName: 'Configured',
      }),
    ).toBe('Al Jazeera Finance');
  });

  it('falls back to the offer partner, then the default lender, then the env value', () => {
    expect(
      resolveLenderOfRecord({ offerPartnerName: 'Offer Partner', defaultLenderName: 'Default Lender' }),
    ).toBe('Offer Partner');
    expect(resolveLenderOfRecord({ defaultLenderName: 'Default Lender', configuredName: 'Configured' })).toBe(
      'Default Lender',
    );
    expect(resolveLenderOfRecord({ configuredName: 'Configured' })).toBe('Configured');
  });

  it('ignores blank names and ends at the Blox Finance fallback', () => {
    expect(resolveLenderOfRecord({ taggedPartnerName: '  ', defaultLenderName: '' })).toBe(
      FALLBACK_LENDER_NAME,
    );
    expect(resolveLenderOfRecord({})).toBe('Blox Finance');
  });
});
