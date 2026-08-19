import { describe, expect, it } from 'vitest';
import { mapApplicationToZohoLead } from './zoho-lead.mapper';

describe('zoho-lead.mapper', () => {
  it('maps customer and pricing fields to Zoho lead shape', () => {
    const payload = mapApplicationToZohoLead(
      {
        id: 'app-1',
        customerEmail: 'customer@example.com',
        customerSnapshot: { full_name: 'Sara Ali', phone: '+974 5555 0001', qid: '28012345678' },
        pricingSnapshot: {
          list_price: 98000,
          down_payment: 9800,
          monthly: 3120,
          tenor: 36,
        },
        status: 'under_review',
        leadSource: null,
        product: {
          make: 'Chery',
          model: 'Tiggo 7',
          modelYear: 2026,
        } as never,
        company: { id: 'c1', name: 'Elite Motors' },
        offer: {} as never,
      },
      'Al Jazeera Finance',
    );

    expect(payload.Email).toBe('customer@example.com');
    expect(payload.QID).toBe('28012345678');
    expect(payload.Request_Submitted_To).toBe('Al Jazeera Finance');
    expect(payload.Vehicle_Make).toBe('Chery');
    expect(String(payload.Monthly_Installment)).toBe('3120');
  });
});
