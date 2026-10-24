import { describe, expect, it } from 'vitest';
import { normalizeCustomerApplication } from './application-dto';

describe('normalizeCustomerApplication dealer name', () => {
  it('uses company.name when present', () => {
    const app = normalizeCustomerApplication({
      id: 'a1',
      status: 'draft',
      created_at: '2026-10-01T00:00:00.000Z',
      company: { name: 'QAuto Retail' },
      product: { company_name: 'Other Dealer' },
    });
    expect(app.dealerName).toBe('QAuto Retail');
  });

  it('falls back to product.company_name when company is missing', () => {
    const app = normalizeCustomerApplication({
      id: 'a1',
      status: 'draft',
      created_at: '2026-10-01T00:00:00.000Z',
      product: { company_name: 'QAuto Retail' },
    });
    expect(app.dealerName).toBe('QAuto Retail');
  });
});
