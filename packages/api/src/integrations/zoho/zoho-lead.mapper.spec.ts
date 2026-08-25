import { describe, expect, it } from 'vitest';
import { mapApplicationToZohoLead } from './zoho-lead.mapper';

/**
 * These assertions are pinned to Al Jazeera's REAL Leads layout, read from
 * GET /crm/v8/settings/fields?module=Leads. The module has no QID, Vehicle_*,
 * Down_Payment, Monthly_Installment, Application_Status or even Description
 * field — sending any of them makes Zoho reject the entire record, so the tests
 * assert their ABSENCE as much as the presence of what we do send.
 */
const base = {
  id: 'app-1',
  customerEmail: 'customer@example.com',
  customerSnapshot: { full_name: 'Sara Ali', phone: '+974 5555 0001', qid: '28012345678' },
  pricingSnapshot: { list_price: 98000, down_payment: 9800, down_payment_pct: 10, monthly: 3120, tenor: 36 },
  status: 'under_review',
  leadSource: null,
  product: { make: 'Chery', model: 'Tiggo 7', modelYear: 2026 } as never,
  company: { id: 'c1', name: 'Elite Motors' },
  offer: { name: 'Al Jazeera Standard' } as never,
};

const map = (over: Record<string, unknown> = {}) =>
  mapApplicationToZohoLead({ ...base, ...over } as never, 'Direct to Partner', 'Partner');

describe('zoho-lead.mapper', () => {
  it('never sends a field that does not exist on the layout', () => {
    const payload = map();
    for (const dead of [
      'QID',
      'Vehicle_Make',
      'Vehicle_Model',
      'Vehicle_Year',
      'Down_Payment',
      'Monthly_Installment',
      'Application_Status',
      'Description',
    ]) {
      expect(payload, `${dead} does not exist in Al Jazeera's Leads module`).not.toHaveProperty(dead);
    }
  });

  it('sends only picklist values that exist on the layout', () => {
    const payload = map();
    expect(payload.Request_Submitted_To).toBe('Direct to Partner');
    expect(payload.Lead_Source).toBe('Partner');
  });

  it('populates the mandatory Last_Name, splitting the full name', () => {
    const payload = map();
    expect(payload.Last_Name).toBe('Ali');
    expect(payload.First_Name).toBe('Sara');
  });

  it('never leaves Last_Name empty — it is the only system-mandatory field', () => {
    const payload = map({ customerSnapshot: { phone: '+974 1' } });
    expect(payload.Last_Name).toBe('customer');
  });

  it('sends numbers to numeric fields, not strings', () => {
    const payload = map();
    // Finance_Amount is `double`, Re_payment_Period is `integer`; Zoho rejects strings.
    expect(typeof payload.Finance_Amount).toBe('number');
    expect(payload.Finance_Amount).toBe(98000);
    expect(typeof payload.Re_payment_Period).toBe('number');
    expect(payload.Re_payment_Period).toBe(36);
  });

  it('prefers selling price over list price for the finance amount', () => {
    const payload = map({ pricingSnapshot: { ...base.pricingSnapshot, selling_price: 91000 } });
    expect(payload.Finance_Amount).toBe(91000);
  });

  it('carries QID, vehicle, instalment and status in the free-text block', () => {
    const details = String(map().Sales_Agent_Comments);
    expect(details).toContain('28012345678');
    expect(details).toContain('Chery Tiggo 7 2026');
    expect(details).toContain('QAR 3,120');
    expect(details).toContain('under_review');
    expect(details).toContain('app-1');
  });

  it('writes reference twins rather than picklists it cannot validate', () => {
    const payload = map({
      customerSnapshot: { ...base.customerSnapshot, nationality: 'Indian', work_sector: 'Private' },
    });
    expect(payload.Nationality).toBe('Indian');
    expect(payload.Work_Sector_Reference).toBe('Private');
    // The picklist twins are left for Al Jazeera's staff to set.
    expect(payload).not.toHaveProperty('Nationality_New');
    expect(payload).not.toHaveProperty('Work_Sector');
  });

  it('never writes Monthly_Commitments — it means the customer existing obligations', () => {
    // Mapping our instalment there would corrupt Al Jazeera's affordability calc.
    expect(map()).not.toHaveProperty('Monthly_Commitments');
  });

  it('clamps values to the layout field lengths', () => {
    const payload = map({ company: { id: 'c1', name: 'X'.repeat(400) } });
    expect(String(payload.Company).length).toBeLessThanOrEqual(200);
    expect(String(payload.Sales_Agent_Comments).length).toBeLessThanOrEqual(2000);
  });

  it('omits optional numerics rather than sending empty strings', () => {
    const payload = map({ pricingSnapshot: {} });
    expect(payload).not.toHaveProperty('Finance_Amount');
    expect(payload).not.toHaveProperty('Re_payment_Period');
  });
});
