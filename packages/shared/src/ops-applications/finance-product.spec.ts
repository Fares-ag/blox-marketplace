import { describe, expect, it } from 'vitest';
import { financeProductKind, financeProductLabelKey } from './finance-product';

describe('finance product labels', () => {
  it('labels Blox Musharakah, in-house conventional, and Zoho partner separately', () => {
    expect(financeProductKind({ financing_type: 'diminishing_musharakah', crm_adapter: 'none' })).toBe('blox');
    expect(financeProductKind({ financing_type: 'conventional_interest', crm_adapter: 'none' })).toBe(
      'in_house',
    );
    expect(financeProductKind({ financing_type: 'diminishing_musharakah', crm_adapter: 'zoho' })).toBe(
      'partner',
    );
    expect(financeProductLabelKey('blox')).toBe('ops.common.bloxFinance');
    expect(financeProductLabelKey('in_house')).toBe('ops.common.inHouseFinance');
    expect(financeProductLabelKey('partner')).toBe('ops.common.partnerFinance');
  });
});
