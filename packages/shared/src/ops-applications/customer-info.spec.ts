import { describe, expect, it } from 'vitest';
import {
  buildCustomerSnapshot,
  customerInfoFromSnapshot,
  emptyCustomerInfo,
  validateCustomerInfo,
  validateRequiredWizardDocuments,
  wizardDocumentSlots,
  wizardRuleViolations,
  type CustomerInfoFormValue,
  type WizardRuleInput,
} from './customer-info';
import { submitGateCode, submitGateMessage } from './submit-gate';
import { ApiError } from '../lib/api';

// 2 = 1900s, 90 = 1990, 634 = Qatar → Qatari national born 1990.
const QATARI_QID = '29063400001';
// 3 = 2000s, 01 = 2001, 356 = India → expatriate born 2001.
const EXPAT_QID = '30135600002';

function individual(overrides: Partial<CustomerInfoFormValue> = {}): CustomerInfoFormValue {
  return {
    ...emptyCustomerInfo(),
    firstName: 'Aisha',
    lastName: 'Al Thani',
    email: 'Aisha@Example.com',
    phone: '+97455512345',
    gender: 'female',
    dateOfBirth: '1990-04-12',
    nationality: 'Qatar',
    qid: QATARI_QID,
    address: { line1: 'Villa 4, Street 12', area: 'Al Waab', city: 'Doha', zone: '55', poBox: '1234' },
    employment: {
      company: 'Qatar Energy',
      position: 'Engineer',
      employmentType: 'gov-or-semi-gov',
      employmentDuration: 'more-than-12-months',
      salary: 0,
    },
    monthlyIncome: 25_000,
    monthlyLiabilities: 2_000,
    ...overrides,
  };
}

describe('buildCustomerSnapshot / customerInfoFromSnapshot', () => {
  it('writes the shared customer-platform shape and round-trips every new field', () => {
    const value = individual({
      hasGuarantor: true,
      guarantor: { fullName: 'Hamad Al Thani', qid: '28563400009', phone: '+97455500000', relationship: 'sibling', monthlyIncome: 18_000 },
    });
    const snapshot = buildCustomerSnapshot(value);

    expect(snapshot).toMatchObject({
      applicantType: 'individual',
      full_name: 'Aisha Al Thani',
      email: 'aisha@example.com',
      qid: QATARI_QID,
      gender: 'female',
      residency: 'qatari',
      city: 'Doha',
      address: { line1: 'Villa 4, Street 12', area: 'Al Waab', city: 'Doha', zone: '55', poBox: '1234' },
      employment: { company: 'Qatar Energy', jobTitle: 'Engineer', employmentType: 'gov-or-semi-gov' },
      monthlyIncome: 25_000,
      monthlyLiabilities: 2_000,
      hasGuarantor: true,
      guarantor: { fullName: 'Hamad Al Thani', qid: '28563400009', relationship: 'sibling', monthlyIncome: 18_000 },
    });
    // Legacy top-level address keys are gone; the nested address is the contract.
    expect(snapshot).not.toHaveProperty('street');
    expect(snapshot).not.toHaveProperty('postalCode');
    // Qatari nationals carry no residence duration.
    expect(snapshot.residenceDuration).toBeUndefined();

    const back = customerInfoFromSnapshot(snapshot);
    expect(back.firstName).toBe('Aisha');
    expect(back.gender).toBe('female');
    expect(back.residency).toBe('qatari');
    expect(back.address).toMatchObject({ line1: 'Villa 4, Street 12', area: 'Al Waab', city: 'Doha', zone: '55', poBox: '1234' });
    expect(back.employment.position).toBe('Engineer');
    expect(back.monthlyLiabilities).toBe(2_000);
    expect(back.hasGuarantor).toBe(true);
    expect(back.guarantor).toMatchObject({ fullName: 'Hamad Al Thani', relationship: 'sibling', monthlyIncome: 18_000 });
  });

  it('keeps expatriate residence duration and derives residency from the QID', () => {
    const snapshot = buildCustomerSnapshot(
      individual({ qid: EXPAT_QID, dateOfBirth: '2001-01-01', nationality: 'India', residency: '', residenceDuration: '1-3-years' }),
    );
    expect(snapshot.residency).toBe('expat');
    expect(snapshot.residenceDuration).toBe('1-3-years');
  });

  it('still reads legacy snapshots (street / postalCode / position)', () => {
    const legacy = customerInfoFromSnapshot({
      full_name: 'Omar Khan',
      qid: EXPAT_QID,
      address: { street: 'Al Sadd St', city: 'Doha', country: 'Qatar', postalCode: '99' },
      employment: { company: 'Acme', position: 'Analyst', employmentType: 'private-local', employmentDuration: 'more-than-12-months' },
      income: 9_000,
    });
    expect(legacy.firstName).toBe('Omar');
    expect(legacy.lastName).toBe('Khan');
    expect(legacy.address.line1).toBe('Al Sadd St');
    expect(legacy.address.poBox).toBe('99');
    expect(legacy.address.country).toBe('Qatar');
    expect(legacy.employment.position).toBe('Analyst');
    expect(legacy.monthlyIncome).toBe(9_000);
    expect(legacy.residency).toBe('expat');
    expect(legacy.hasGuarantor).toBe(false);
  });

  it('leaves corporate applicants unchanged', () => {
    const corporate: CustomerInfoFormValue = {
      ...emptyCustomerInfo(),
      applicantType: 'corporate',
      corporate: {
        legalName: 'Doha Motors WLL',
        crNumber: '12345',
        registeredAddress: { street: 'C Ring Rd', city: 'Doha', country: 'Qatar', postalCode: '', state: '' },
        authorizedSignatory: { firstName: 'Ali', lastName: 'Saleh', email: 'ali@dohamotors.qa', phone: '+97444400000', qid: QATARI_QID },
      },
    };
    const snapshot = buildCustomerSnapshot(corporate);
    expect(snapshot.applicantType).toBe('corporate');
    expect(snapshot.full_name).toBe('Doha Motors WLL');
    expect((snapshot.corporate as { registeredAddress: { street: string } }).registeredAddress.street).toBe('C Ring Rd');
    expect(customerInfoFromSnapshot(snapshot).corporate.crNumber).toBe('12345');
  });
});

describe('validateCustomerInfo', () => {
  it('accepts a complete individual applicant', () => {
    expect(validateCustomerInfo(individual())).toBeNull();
  });

  it('rejects a date of birth that disagrees with the QID birth year', () => {
    expect(validateCustomerInfo(individual({ dateOfBirth: '1985-04-12' }))).toMatch(/birth year/);
  });

  it('rejects a date of birth whose year is not four digits', () => {
    // "19901-04-12" used to read as 1990 and pass the QID cross-check.
    expect(validateCustomerInfo(individual({ dateOfBirth: '19901-04-12' }))).toMatch(/calendar date/);
    expect(validateCustomerInfo(individual({ dateOfBirth: '1990-02-31' }))).toMatch(/calendar date/);
  });

  it('requires gender', () => {
    expect(validateCustomerInfo(individual({ gender: '' }))).toMatch(/Gender/);
  });

  it('rejects an email that only looks like one', () => {
    // Intake accepted anything containing "@", so submit was the first thing
    // that noticed — on the last step, after all the work was done.
    expect(validateCustomerInfo(individual({ email: '@' }))).toMatch(/valid email/);
    expect(validateCustomerInfo(individual({ email: 'aisha@example' }))).toMatch(/valid email/);
    expect(validateCustomerInfo(individual({ email: '' }))).toMatch(/Email is required/);
  });

  it('requires a Qatar phone number rather than any digits at all', () => {
    expect(validateCustomerInfo(individual({ phone: '1234' }))).toMatch(/Qatar phone/);
    expect(validateCustomerInfo(individual({ phone: '555123456' }))).toMatch(/Qatar phone/);
    expect(validateCustomerInfo(individual({ phone: '55512345' }))).toBeNull();
  });

  it('accepts zero monthly commitments, as the field hint promises', () => {
    expect(validateCustomerInfo(individual({ monthlyLiabilities: 0 }))).toBeNull();
    expect(validateCustomerInfo(individual({ monthlyLiabilities: -1 }))).toMatch(/negative/);
  });

  it('requires residence duration for expatriates only', () => {
    const expat = individual({ qid: EXPAT_QID, dateOfBirth: '2001-05-05', nationality: 'India', residency: '' });
    expect(validateCustomerInfo(expat)).toMatch(/Time in Qatar/);
    expect(validateCustomerInfo({ ...expat, residenceDuration: '6-12-months' })).toBeNull();
  });

  it('validates the guarantor block when present', () => {
    const withGuarantor = individual({ hasGuarantor: true });
    expect(validateCustomerInfo(withGuarantor)).toMatch(/Guarantor full name/);
    expect(
      validateCustomerInfo({
        ...withGuarantor,
        guarantor: { fullName: 'Hamad', qid: '123', phone: '', relationship: '', monthlyIncome: 0 },
      }),
    ).toMatch(/Guarantor Qatar ID/);
  });

  it('routes messages through the translator with the key and default', () => {
    const seen: string[] = [];
    const t = (key: string, options?: { defaultValue?: string }) => {
      seen.push(key);
      return `T:${options?.defaultValue ?? key}`;
    };
    expect(validateCustomerInfo(individual({ firstName: '' }), t)).toBe('T:First and last name are required.');
    expect(seen).toEqual(['dealerOps.validation.nameRequired']);
  });
});

describe('document slots in the wizard', () => {
  it('derives required documents from residency, employment type and guarantor', () => {
    const qatari = wizardDocumentSlots(individual());
    expect(qatari.find((s) => s.category === 'passport')?.required).toBe(false);
    expect(qatari.filter((s) => s.required).map((s) => s.category)).toEqual(['qid', 'salary', 'bank']);

    const expatSelfEmployedWithGuarantor = wizardDocumentSlots(
      individual({
        qid: EXPAT_QID,
        residency: '',
        employment: { ...individual().employment, employmentType: 'self-employed' },
        hasGuarantor: true,
      }),
    );
    const required = expatSelfEmployedWithGuarantor.filter((s) => s.required).map((s) => s.category);
    expect(required).toEqual(['qid', 'passport', 'cr', 'trade_license', 'business_bank', 'bank', 'guarantor_qid', 'guarantor_salary']);
    expect(expatSelfEmployedWithGuarantor.some((s) => s.category === 'vehicle_quotation')).toBe(true);
  });

  it('keeps the corporate document set', () => {
    const slots = wizardDocumentSlots({ ...emptyCustomerInfo(), applicantType: 'corporate' });
    expect(slots.map((s) => s.category)).toEqual(['cr', 'computer_card', 'rental_agreement', 'signatory_id']);
    expect(slots.every((s) => s.required)).toBe(true);
  });

  it('reports missing required files, treating `id` as a Qatar ID', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateRequiredWizardDocuments({ id: file, salary: file, bank: file }, individual())).toBeNull();
    expect(validateRequiredWizardDocuments({ qid: file }, individual())).toMatch(/salary certificate|Salary/i);
    // Legacy signature (applicant type only) keeps working for older callers.
    expect(validateRequiredWizardDocuments({ qid: file, salary: file, bank: file }, 'individual')).toBeNull();
  });
});

describe('wizardRuleViolations', () => {
  const base: WizardRuleInput = {
    info: individual(),
    vehicle: { price: 120_000, condition: 'new', modelYear: 2025 },
    tenureMonths: 36,
    downPaymentPct: 20,
    offerTenureOptions: [12, 24, 36, 48, 60],
    offerMinDownPaymentPct: 10,
  };

  it('is clean for a compliant new-car plan: car financing is uncapped', () => {
    const violations = wizardRuleViolations({ ...base, vehicle: { ...base.vehicle } });
    expect(violations).toEqual([]);
  });

  it('still flags a motorcycle over its cap, and keeps it soft', () => {
    const violations = wizardRuleViolations({
      ...base,
      vehicle: { price: 40_000, condition: 'new', modelYear: 2025, category: 'motorcycle' },
    });
    expect(violations.map((v) => v.code)).toEqual(['financing_amount_exceeds_cap']);
    expect(violations.every((v) => v.severity === 'soft')).toBe(true);
  });

  it('lets an expatriate take 60 months at 10% down, flagging both for review', () => {
    const expat = individual({ qid: EXPAT_QID, dateOfBirth: '2001-01-01', residency: '', residenceDuration: '1-3-years' });
    const violations = wizardRuleViolations({ ...base, info: expat, tenureMonths: 60, downPaymentPct: 10 });
    expect(violations.filter((v) => v.severity === 'hard')).toEqual([]);
    const soft = violations.filter((v) => v.severity === 'soft').map((v) => v.code);
    expect(soft).toContain('tenure_above_recommended');
    expect(soft).toContain('down_payment_below_recommended');
  });

  it('still refuses a tenure outside the hard band', () => {
    const violations = wizardRuleViolations({ ...base, tenureMonths: 72 });
    expect(violations.filter((v) => v.severity === 'hard').map((v) => v.code)).toContain('tenure_above_max');
  });

  it('flags corporate applicants softly so the dealer corporate flow keeps working', () => {
    const violations = wizardRuleViolations({ ...base, info: { ...individual(), applicantType: 'corporate' } });
    expect(violations.find((v) => v.code === 'corporate_not_eligible')?.severity).toBe('soft');
  });
});

describe('submit gates', () => {
  const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

  it('maps known machine codes and ignores everything else', () => {
    expect(submitGateCode(new ApiError('x', 409, 'identity_hold'))).toBe('identity_hold');
    expect(submitGateCode(new ApiError('x', 409, 'conflict'))).toBeNull();
    expect(submitGateCode(new Error('boom'))).toBeNull();
  });

  it('lists the missing categories when the API attaches them', () => {
    const error = Object.assign(new ApiError('x', 409, 'documents_missing'), { details: { missing: ['salary', 'bank'] } });
    expect(submitGateMessage(error, t)).toBe('documents missing (salary, bank)');
  });
});
