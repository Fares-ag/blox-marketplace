import { describe, expect, it } from 'vitest';
import { documentSlotsFor } from '@drivemarket/shared';
import {
  buildPlanPricing,
  creditPreviewFor,
  deriveIdentity,
  emptyApplyForm,
  firstIncompleteStep,
  formFromSnapshot,
  normalizePlan,
  planFromPricingSnapshot,
  prefillFromAccount,
  snapshotFromForm,
  staleDocumentCategories,
  validateEmployment,
  validateGuarantor,
  validateIdentity,
  validateStep,
  type ApplyForm,
  type PlanContext,
} from './apply-model';

const NOW = new Date('2026-09-07T00:00:00Z');

// Expat (India, 356) born 1990 and a Qatari (634) born 1985.
const EXPAT_QID = '29035600123';
const QATARI_QID = '28563400456';

function filledForm(overrides: Partial<ApplyForm> = {}): ApplyForm {
  return {
    ...emptyApplyForm(),
    firstName: 'Amal',
    lastName: 'Rahman',
    gender: 'female',
    dateOfBirth: '1990-04-12',
    qid: EXPAT_QID,
    residenceDuration: '1-3-years',
    phone: '+974 5555 1234',
    email: 'amal@example.com',
    city: 'Doha',
    employer: 'Blox LLC',
    employmentType: 'private-local',
    employmentDuration: 'more-than-12-months',
    monthlyIncome: '12,000',
    monthlyLiabilities: '1500',
    ...overrides,
  };
}

const CTX: PlanContext = {
  price: 120_000,
  condition: 'new',
  modelYear: 2025,
  annualRatePercent: 12,
  offerTenureOptions: [12, 24, 36, 48, 60],
  offerMinDownPct: 10,
};

describe('deriveIdentity', () => {
  it('reads residency and nationality from the QID', () => {
    const d = deriveIdentity(filledForm(), 'en', NOW);
    expect(d.parsed.valid).toBe(true);
    expect(d.residency).toBe('expat');
    expect(d.nationalityLabel).toBe('India');
    expect(d.nationalityValue).toBe('India');
    expect(d.dobMatch).toBe(true);
    expect(d.age).toBe(36);
  });

  it('localises the nationality and flags a birth-year mismatch', () => {
    const d = deriveIdentity(filledForm({ qid: QATARI_QID, dateOfBirth: '1990-04-12' }), 'ar', NOW);
    expect(d.residency).toBe('qatari');
    expect(d.nationalityLabel).toBe('قطر');
    expect(d.dobMatch).toBe(false);
  });
});

describe('validateIdentity', () => {
  it('passes a complete expat profile', () => {
    expect(validateIdentity(filledForm(), NOW)).toEqual({});
  });

  it('requires residence duration for expats only', () => {
    expect(validateIdentity(filledForm({ residenceDuration: '' }), NOW)).toMatchObject({
      residenceDuration: 'applyFlow.error.required',
    });
    expect(
      validateIdentity(filledForm({ qid: QATARI_QID, dateOfBirth: '1985-01-01', residenceDuration: '' }), NOW),
    ).toEqual({});
  });

  it('reports invalid QID, DOB mismatch, age range and phone', () => {
    const errors = validateIdentity(
      filledForm({ qid: '1234', dateOfBirth: '2015-01-01', phone: '12' }),
      NOW,
    );
    expect(errors.qid).toBe('applyFlow.error.invalidQid');
    expect(errors.dateOfBirth).toBe('applyFlow.error.ageRange');
    expect(errors.phone).toBe('applyFlow.error.invalidPhone');

    const mismatch = validateIdentity(filledForm({ dateOfBirth: '1991-04-12' }), NOW);
    expect(mismatch.dateOfBirth).toBe('applyFlow.identity.dobMismatch');
  });

  it('asks for a typed nationality when the QID country code is unknown', () => {
    // 999 is not an ISO numeric code we know.
    const errors = validateIdentity(filledForm({ qid: '29099900123' }), NOW);
    expect(errors.nationality).toBe('applyFlow.error.required');
    expect(validateIdentity(filledForm({ qid: '29099900123', nationality: 'Atlantis' }), NOW)).toEqual({});
  });
});

describe('validateEmployment / validateGuarantor', () => {
  it('needs employer, type, duration and a positive income', () => {
    const errors = validateEmployment(filledForm({ employer: '', employmentType: '', monthlyIncome: '0' }));
    expect(errors).toMatchObject({
      employer: 'applyFlow.error.required',
      employmentType: 'applyFlow.error.required',
      monthlyIncome: 'applyFlow.error.invalidAmount',
    });
    expect(validateEmployment(filledForm())).toEqual({});
  });

  it('only validates the guarantor block when enabled', () => {
    expect(validateGuarantor(filledForm(), NOW)).toEqual({});
    const errors = validateGuarantor(
      filledForm({ hasGuarantor: true, guarantor: { fullName: '', qid: '12', phone: '', relationship: '', monthlyIncome: 'abc' } }),
      NOW,
    );
    expect(errors['guarantor.fullName']).toBe('applyFlow.error.required');
    expect(errors['guarantor.qid']).toBe('applyFlow.error.invalidQid');
    expect(errors['guarantor.relationship']).toBe('applyFlow.error.required');
    expect(errors['guarantor.monthlyIncome']).toBe('applyFlow.error.invalidAmount');
  });
});

describe('plan helpers', () => {
  it('leaves an unusual but allowed plan alone and only clamps the hard band', () => {
    // 60 months at 5% down is inside the accepted bands for an expatriate; it
    // is flagged for review rather than rewritten under the customer.
    const expat = normalizePlan({ tenure: 60, downPct: 5 }, CTX, 'expat');
    expect(expat.plan).toEqual({ tenure: 60, downPct: 5 });
    expect(expat.adjusted).toBe(false);
    const qatari = normalizePlan({ tenure: 60, downPct: 25 }, CTX, 'qatari');
    expect(qatari.plan).toEqual({ tenure: 60, downPct: 25 });
    expect(qatari.adjusted).toBe(false);
    // Outside the band it is pulled back in.
    const wild = normalizePlan({ tenure: 96, downPct: 150 }, CTX, 'qatari');
    expect(wild.plan).toEqual({ tenure: 60, downPct: 90 });
    expect(wild.adjusted).toBe(true);
  });

  it('blocks the vehicle step only on a hard product-rule violation', () => {
    // Over the hard band: refused.
    expect(validateStep('vehicle', filledForm(), { tenure: 96, downPct: 20 }, CTX, 'expat', NOW)).toEqual({
      plan: 'applyFlow.error.ruleViolation',
    });
    // Over the residency guideline: allowed through, flagged elsewhere.
    expect(validateStep('vehicle', filledForm(), { tenure: 60, downPct: 20 }, CTX, 'expat', NOW)).toEqual({});
    expect(validateStep('vehicle', filledForm(), { tenure: 48, downPct: 20 }, CTX, 'expat', NOW)).toEqual({});
  });

  it('reads a plan back from a pricing snapshot', () => {
    expect(planFromPricingSnapshot({ tenor: 36, down_payment_pct: 25 })).toEqual({ tenure: 36, downPct: 25 });
    expect(planFromPricingSnapshot({ monthly: 1 })).toBeNull();
  });
});

describe('snapshot round trip', () => {
  it('produces the shared snapshot shape and hydrates back into the same form', () => {
    const form = filledForm({
      hasGuarantor: true,
      guarantor: { fullName: 'Sami Rahman', qid: QATARI_QID, phone: '55551235', relationship: 'spouse', monthlyIncome: '9000' },
    });
    const snapshot = snapshotFromForm(form, deriveIdentity(form, 'en', NOW));
    expect(snapshot).toMatchObject({
      full_name: 'Amal Rahman',
      phone: '+974 5555 1234',
      qid: EXPAT_QID,
      applicantType: 'individual',
      gender: 'female',
      nationality: 'India',
      residency: 'expat',
      residenceDuration: '1-3-years',
      city: 'Doha',
      address: { city: 'Doha' },
      employment: { company: 'Blox LLC', employmentType: 'private-local', employmentDuration: 'more-than-12-months', salary: 12000 },
      income: 12000,
      monthlyIncome: 12000,
      monthlyLiabilities: 1500,
      hasGuarantor: true,
      guarantor: { fullName: 'Sami Rahman', qid: QATARI_QID, relationship: 'spouse', monthlyIncome: 9000 },
    });
    expect(Object.keys(snapshot)).not.toContain('undefined');

    const back = formFromSnapshot(snapshot);
    expect(back).toEqual({ ...form, monthlyIncome: '12000', monthlyLiabilities: '1500' });
  });

  it('omits empty optional values and defaults liabilities to zero', () => {
    const form = filledForm({ email: '', city: '', gender: '', monthlyLiabilities: '' });
    const snapshot = snapshotFromForm(form, deriveIdentity(form, 'en', NOW));
    expect(snapshot).not.toHaveProperty('email');
    expect(snapshot).not.toHaveProperty('city');
    expect(snapshot).not.toHaveProperty('address');
    expect(snapshot).not.toHaveProperty('gender');
    expect(snapshot).not.toHaveProperty('guarantor');
    expect(snapshot.monthlyLiabilities).toBe(0);
  });

  it('hydrates legacy snapshots (string employment, full_name only)', () => {
    const form = formFromSnapshot({ full_name: 'Noor Al Thani', phone: '5551', qid: QATARI_QID, employment: 'QNB', income: 15000 });
    expect(form.firstName).toBe('Noor');
    expect(form.lastName).toBe('Al Thani');
    expect(form.employer).toBe('QNB');
    expect(form.monthlyIncome).toBe('15000');
  });
});

describe('prefill and resume', () => {
  it('prefills identity from the account without overwriting typed values', () => {
    const seeded = prefillFromAccount(emptyApplyForm(), { fullName: 'Amal Rahman', phone: '5555', email: 'a@x.io', qid: '290 356 00123' });
    expect(seeded).toMatchObject({ firstName: 'Amal', lastName: 'Rahman', phone: '5555', email: 'a@x.io', qid: EXPAT_QID });
    const kept = prefillFromAccount({ ...emptyApplyForm(), firstName: 'Zed' }, { fullName: 'Amal Rahman' });
    expect(kept.firstName).toBe('Zed');
    expect(kept.lastName).toBe('');
  });

  it('reopens a resumed draft at the first incomplete step', () => {
    expect(firstIncompleteStep(emptyApplyForm(), { tenure: 36, downPct: 20 }, CTX, null, NOW)).toBe('identity');
    expect(firstIncompleteStep(filledForm({ employer: '' }), { tenure: 36, downPct: 20 }, CTX, 'expat', NOW)).toBe('employment');
    expect(firstIncompleteStep(filledForm(), { tenure: 36, downPct: 20 }, CTX, 'expat', NOW)).toBe('documents');
  });
});

describe('creditPreviewFor', () => {
  const pricing = buildPlanPricing({ tenure: 36, downPct: 20 }, CTX);

  it('is null until the plan is priced', () => {
    expect(creditPreviewFor(filledForm(), 'expat', null, [], NOW)).toBeNull();
  });

  it('refers with affordability_unknown when the income is missing', () => {
    const preview = creditPreviewFor(filledForm({ monthlyIncome: '' }), 'expat', pricing, [], NOW);
    expect(preview?.affordability).toBeNull();
    expect(preview?.path).toBe('refer');
    expect(preview?.reasons).toContain('affordability_unknown');
  });

  it('declines above the hard cap and adds the guarantor view when their income is given', () => {
    const alone = creditPreviewFor(filledForm({ monthlyIncome: '3000' }), 'expat', pricing, [], NOW);
    expect(alone?.path).toBe('decline');
    expect(alone?.reasons).toContain('dbr_above_hard_cap');
    expect(alone?.affordabilityWithGuarantor).toBeNull();

    const withGuarantor = creditPreviewFor(
      filledForm({
        monthlyIncome: '3000',
        hasGuarantor: true,
        guarantor: { fullName: 'Sami', qid: QATARI_QID, phone: '55551235', relationship: 'spouse', monthlyIncome: '20000' },
      }),
      'expat',
      pricing,
      [],
      NOW,
    );
    expect(withGuarantor?.affordabilityWithGuarantor).not.toBeNull();
    expect(withGuarantor!.affordabilityWithGuarantor!.dbr).toBeLessThan(alone!.affordability!.dbr);
    expect(withGuarantor?.path).not.toBe('decline');
  });

  it('carries plan violations into the preview', () => {
    const preview = creditPreviewFor(
      filledForm({ monthlyIncome: '40000', monthlyLiabilities: '0' }),
      'expat',
      pricing,
      [{ code: 'financing_amount_exceeds_cap', severity: 'soft', params: {} }],
      NOW,
    );
    expect(preview?.reasons).toContain('soft_rule_flags');
    expect(preview?.path).not.toBe('approve');
  });
});

describe('staleDocumentCategories', () => {
  const slots = documentSlotsFor({ residency: 'expat', employmentType: 'private-local', hasGuarantor: false, applicantType: 'individual' });

  it('flags time-sensitive uploads older than their max age and keeps the server list', () => {
    const uploadedAt = { salary: '2026-07-01T00:00:00Z', bank: '2026-09-01T00:00:00Z', qid: '2026-01-01T00:00:00Z' };
    expect(staleDocumentCategories(slots, uploadedAt, [], NOW)).toEqual(['salary']);
    expect(staleDocumentCategories(slots, uploadedAt, ['bank'], NOW)).toEqual(['salary', 'bank']);
    expect(staleDocumentCategories(slots, {}, [], NOW)).toEqual([]);
  });
});
