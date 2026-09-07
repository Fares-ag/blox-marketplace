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
  product: { make: 'Chery', model: 'Tiggo 7', modelYear: 2026, condition: 'used' } as never,
  company: { id: 'c1', name: 'Elite Motors' },
  offer: { name: 'Al Jazeera Standard' } as never,
};

const map = (over: Record<string, unknown> = {}) =>
  mapApplicationToZohoLead({ ...base, ...over } as never, 'Direct to Partner', 'Partners');

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
    expect(payload.Lead_Source).toBe('Partners');
  });

  it('never assigns Prospect Owner or Sales Agent', () => {
    const payload = map();
    expect(payload).not.toHaveProperty('Owner');
    expect(payload).not.toHaveProperty('Sales_Agent');
    expect(payload).not.toHaveProperty('Prospect_Owner');
  });

  it('carries Used/New Car and Age in Sales_Agent_Comments', () => {
    const details = String(
      map({
        product: { ...base.product, condition: 'new' },
        customerSnapshot: { ...base.customerSnapshot, dateOfBirth: '1990-06-15' },
      }).Sales_Agent_Comments,
    );
    expect(details).toContain('Used / New Car: New Car');
    expect(details).toMatch(/Age: \d+/);
  });

  it('maps current obligations to Reason_for_Request', () => {
    const payload = map({
      customerSnapshot: {
        ...base.customerSnapshot,
        currentObligations: 'QAR 2,500 monthly personal loan',
      },
    });
    expect(payload.Reason_for_Request).toBe('QAR 2,500 monthly personal loan');
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
      customerSnapshot: {
        ...base.customerSnapshot,
        nationality: 'Indian',
        employment: { employmentType: 'self-employed' },
      },
    });
    expect(payload.Nationality).toBe('Indian');
    expect(payload.Work_Sector_Reference).toBe('Self employed');
    // Nationality_New is a full country picklist and our value is a demonym
    // ("Indian" vs "India"), so it is never written — a mismatch would reject
    // the record. self-employed likewise has no counterpart in Work_Sector.
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

  /**
   * These read the shape buildCustomerSnapshot really produces. An invented key
   * name here fails silently — the field is just never sent — which is exactly
   * how employment type, duration and income were being dropped.
   */
  describe('against the real customerSnapshot shape', () => {
    const realistic = {
      applicantType: 'individual',
      firstName: 'Sara',
      lastName: 'Ali',
      full_name: 'Sara Ali',
      email: 'sara@example.com',
      phone: '+974 5555 0001',
      qid: '28012345678',
      nationality: 'Indian',
      address: { street: '12 Al Sadd', city: 'Doha', country: 'QA', postalCode: '' },
      street: '12 Al Sadd',
      city: 'Doha',
      employment: {
        company: 'Ooredoo',
        position: 'Engineer',
        employmentType: 'private-local',
        employmentDuration: 'more-than-12-months',
        salary: 18000,
      },
      income: 18000,
      monthlyIncome: 18000,
    };

    it('reads employment duration from employment.employmentDuration', () => {
      expect(map({ customerSnapshot: realistic }).Employment_Duration).toBe('More than 12 months');
    });

    it('reads work sector from employment.employmentType', () => {
      const payload = map({ customerSnapshot: realistic });
      expect(payload.Work_Sector_Reference).toBe('Private local');
      expect(payload.Work_Sector).toBe('Private');
    });

    it('reads income from monthlyIncome', () => {
      expect(map({ customerSnapshot: realistic }).Salary_Reference).toBe('QAR 18,000');
    });

    it('routes salary to the expat field for a non-Qatari', () => {
      const payload = map({ customerSnapshot: realistic });
      expect(payload.Total_Salary_Expat).toBe(18000);
      expect(payload).not.toHaveProperty('Basic_Salary_Qatari');
    });

    it('routes salary to the Qatari field for a Qatari', () => {
      const payload = map({ customerSnapshot: { ...realistic, nationality: 'Qatari' } });
      expect(payload.Basic_Salary_Qatari).toBe(18000);
      expect(payload).not.toHaveProperty('Total_Salary_Expat');
    });

    it('sends city and full name', () => {
      const payload = map({ customerSnapshot: realistic });
      expect(payload.City).toBe('Doha');
      expect(payload.Full_Name).toBe('Sara Ali');
    });

    it('always declares the finance type — every Blox application is vehicle finance', () => {
      expect(map().Finance_Type).toBe('Car Finance');
    });

    it('leaves ambiguous employment types out of the picklist', () => {
      // gov-or-semi-gov spans two of their options; an unknown picklist value
      // would reject the whole record, so only the free-text twin is sent.
      const payload = map({
        customerSnapshot: { ...realistic, employment: { employmentType: 'gov-or-semi-gov' } },
      });
      expect(payload.Work_Sector_Reference).toBe('Gov or semi gov');
      expect(payload).not.toHaveProperty('Work_Sector');
    });
  });

  describe('QID fallback from the customer record', () => {
    const comments = (over: Record<string, unknown>, fallbacks?: { qid?: string | null }) =>
      String(mapApplicationToZohoLead({ ...base, ...over } as never, 'Direct to Partner', 'Partners', fallbacks).Sales_Agent_Comments);

    it('keeps the snapshot QID when present', () => {
      expect(comments({}, { qid: '29999999999' })).toContain('QID: 28012345678');
      expect(comments({}, { qid: '29999999999' })).not.toContain('29999999999');
    });

    it('falls back to the decrypted customer QID when the snapshot has none', () => {
      const snapshot = { ...base.customerSnapshot, qid: undefined };
      expect(comments({ customerSnapshot: snapshot }, { qid: '29999999999' })).toContain('QID: 29999999999');
      expect(comments({ customerSnapshot: snapshot }, { qid: null })).not.toContain('QID:');
      expect(comments({ customerSnapshot: snapshot })).not.toContain('QID:');
    });
  });
});
