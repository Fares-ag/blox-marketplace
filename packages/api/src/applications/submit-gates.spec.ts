import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  SUBMIT_GATE_ORDER,
  assertSubmitGates,
  evaluateSubmitGates,
  guarantorConsentRequired,
  identityHoldActive,
  vehicleIdentityComplete,
  type SubmitGateInput,
} from './submit-gates';

const NOW = new Date('2026-09-07T00:00:00.000Z');

/** Expat (India, born 1990) salaried applicant, 36-month plan. */
const EXPAT_SNAPSHOT = {
  full_name: 'Priya Nair',
  phone: '+97455512345',
  qid: '29035612345',
  applicantType: 'individual',
  employment: { employmentType: 'private-local' },
};

function input(overrides: Partial<SubmitGateInput> = {}): SubmitGateInput {
  return {
    application: {
      identityHoldAt: null,
      identityHoldClearedAt: null,
      consentsCompletedAt: new Date('2026-09-01T00:00:00.000Z'),
      customerSnapshot: EXPAT_SNAPSHOT,
      pricingSnapshot: { tenor: 36, down_payment_pct: 20, list_price: 80_000 },
    },
    documents: [
      { category: 'qid' },
      { category: 'passport' },
      { category: 'salary' },
      { category: 'bank' },
    ],
    product: { vin: 'VIN1', chassisNumber: 'CH1', engineNumber: 'EN1', modelYear: 2024 },
    requireVehicleIdentity: true,
    now: NOW,
    ...overrides,
  };
}

describe('evaluateSubmitGates', () => {
  it('passes a complete application', () => {
    expect(evaluateSubmitGates(input())).toBeNull();
  });

  it('checks the gates in the documented order', () => {
    expect(SUBMIT_GATE_ORDER).toEqual([
      'identity_hold',
      'consents_required',
      'documents_missing',
      'documents_stale',
      'guarantor_consent_required',
      'vehicle_identity_incomplete',
      'vehicle_age_rule',
    ]);

    // Everything failing at once → identity hold first.
    const everythingWrong = input({
      application: {
        identityHoldAt: new Date('2026-09-02T00:00:00.000Z'),
        identityHoldClearedAt: null,
        consentsCompletedAt: null,
        customerSnapshot: EXPAT_SNAPSHOT,
        pricingSnapshot: { tenor: 60 },
      },
      documents: [],
      product: { vin: null, chassisNumber: null, engineNumber: null, modelYear: 2010 },
    });
    expect(evaluateSubmitGates(everythingWrong)?.code).toBe('identity_hold');

    // Hold cleared by credit → consents next.
    const holdCleared = input({
      ...everythingWrong,
      application: { ...everythingWrong.application, identityHoldClearedAt: new Date('2026-09-03T00:00:00.000Z') },
    });
    expect(evaluateSubmitGates(holdCleared)?.code).toBe('consents_required');

    // Consents captured → documents, with the profile-aware missing list.
    const consented = input({
      ...holdCleared,
      application: { ...holdCleared.application, consentsCompletedAt: new Date('2026-09-04T00:00:00.000Z') },
    });
    expect(evaluateSubmitGates(consented)).toEqual({
      code: 'documents_missing',
      missing: ['qid', 'passport', 'salary', 'bank'],
    });

    // Documents in but the salary certificate is 45 days old → freshness.
    const staleDocs = input({
      ...consented,
      documents: input().documents.map((doc) =>
        doc.category === 'salary' ? { ...doc, createdAt: new Date('2026-07-24T00:00:00.000Z') } : doc,
      ),
    });
    expect(evaluateSubmitGates(staleDocs)).toEqual({ code: 'documents_stale', stale: ['salary'] });

    // Fresh documents, a declared guarantor without a completed consent session → guarantor gate.
    const guarantorPending = input({
      ...consented,
      application: {
        ...consented.application,
        customerSnapshot: {
          ...EXPAT_SNAPSHOT,
          hasGuarantor: true,
          guarantor: { fullName: 'A', qid: '28563412345', phone: '+97455598765', relationship: 'sibling' },
        },
      },
      documents: [...input().documents, { category: 'guarantor_qid' }, { category: 'guarantor_salary' }],
    });
    expect(evaluateSubmitGates(guarantorPending)?.code).toBe('guarantor_consent_required');
    expect(evaluateSubmitGates({ ...guarantorPending, guarantorConsentCompleted: true })?.code).toBe(
      'vehicle_age_rule',
    );

    // Documents in → age rule when the vehicle would exceed the limit (identity gate optional for now).
    const documented = input({
      ...consented,
      documents: input().documents,
      product: { vin: null, chassisNumber: null, engineNumber: null, modelYear: 2010 },
    });
    expect(evaluateSubmitGates(documented)?.code).toBe('vehicle_age_rule');

    // Recent model year with optional identity → passes.
    const identified = input({ ...consented, documents: input().documents, product: input().product });
    expect(evaluateSubmitGates(identified)).toBeNull();
  });

  it('requires the passport only for expatriates', () => {
    const qatari = input({
      application: {
        ...input().application,
        customerSnapshot: { ...EXPAT_SNAPSHOT, qid: '28563412345' },
      },
      documents: [{ category: 'qid' }, { category: 'salary' }, { category: 'bank' }],
    });
    expect(evaluateSubmitGates(qatari)).toBeNull();
  });

  it('asks self-employed applicants for the business pack', () => {
    const selfEmployed = input({
      application: {
        ...input().application,
        customerSnapshot: { ...EXPAT_SNAPSHOT, employment: { employmentType: 'self-employed' } },
      },
      documents: [{ category: 'qid' }, { category: 'passport' }, { category: 'bank' }],
    });
    expect(evaluateSubmitGates(selfEmployed)).toEqual({
      code: 'documents_missing',
      missing: ['cr', 'trade_license', 'business_bank'],
    });
  });

  it('asks for guarantor documents when a guarantor is declared', () => {
    const withGuarantor = input({
      application: {
        ...input().application,
        customerSnapshot: { ...EXPAT_SNAPSHOT, hasGuarantor: true, guarantor: { fullName: 'A', qid: '28563412345' } },
      },
    });
    expect(evaluateSubmitGates(withGuarantor)).toEqual({
      code: 'documents_missing',
      missing: ['guarantor_qid', 'guarantor_salary'],
    });
  });

  it('keeps the legacy core set for corporate applicants', () => {
    const corporate = input({
      application: {
        ...input().application,
        customerSnapshot: { ...EXPAT_SNAPSHOT, applicantType: 'corporate' },
      },
      documents: [{ category: 'cr' }, { category: 'computer_card' }],
    });
    expect(evaluateSubmitGates(corporate)).toEqual({
      code: 'documents_missing',
      missing: ['qid', 'salary', 'bank'],
    });
  });

  it('accepts KYC-verified identity slots and the legacy id category for the QID', () => {
    const kyc = input({
      documents: [
        { category: 'qid', kycDocumentType: 'qid_front', verificationStatus: 'verified' },
        { category: 'passport' },
        { category: 'salary' },
        { category: 'bank' },
      ],
    });
    expect(evaluateSubmitGates(kyc)).toBeNull();
    const legacyId = input({
      documents: [{ category: 'id' }, { category: 'passport' }, { category: 'salary' }, { category: 'bank' }],
    });
    expect(evaluateSubmitGates(legacyId)).toBeNull();
  });

  it('skips the vehicle identity gate when the listing is not being reserved', () => {
    const resubmit = input({
      requireVehicleIdentity: false,
      product: { vin: null, chassisNumber: null, engineNumber: null, modelYear: 2024 },
    });
    expect(evaluateSubmitGates(resubmit)).toBeNull();
  });

  it('can skip the consent gate for flows that capture consents later', () => {
    const noConsents = input({
      application: { ...input().application, consentsCompletedAt: null },
      requireConsents: false,
    });
    expect(evaluateSubmitGates(noConsents)).toBeNull();
  });

  it('flags only time-sensitive slots whose newest upload is older than allowed', () => {
    const old = new Date('2026-07-01T00:00:00.000Z');
    const recent = new Date('2026-09-01T00:00:00.000Z');
    // A re-upload of the bank statement supersedes the old one; the passport has no max age.
    const docs = input({
      documents: [
        { category: 'qid', createdAt: old },
        { category: 'passport', createdAt: old },
        { category: 'salary', createdAt: recent },
        { category: 'bank', createdAt: old },
        { category: 'bank', createdAt: recent },
      ],
    });
    expect(evaluateSubmitGates(docs)).toBeNull();

    const staleBoth = input({
      documents: [
        { category: 'qid', createdAt: old },
        { category: 'passport', createdAt: old },
        { category: 'salary', createdAt: old },
        { category: 'bank', createdAt: old },
      ],
    });
    expect(evaluateSubmitGates(staleBoth)).toEqual({ code: 'documents_stale', stale: ['salary', 'bank'] });
  });

  it('requires the guarantor consent session only when a guarantor is declared', () => {
    const withGuarantor = input({
      application: {
        ...input().application,
        customerSnapshot: {
          ...EXPAT_SNAPSHOT,
          hasGuarantor: true,
          guarantor: { fullName: 'A', qid: '28563412345', phone: '+97455598765', relationship: 'sibling' },
        },
      },
      documents: [...input().documents, { category: 'guarantor_qid' }, { category: 'guarantor_salary' }],
    });
    expect(guarantorConsentRequired(withGuarantor.application, undefined)).toBe(true);
    expect(guarantorConsentRequired(withGuarantor.application, false)).toBe(true);
    expect(guarantorConsentRequired(withGuarantor.application, true)).toBe(false);
    expect(guarantorConsentRequired(input().application, undefined)).toBe(false);
    expect(evaluateSubmitGates(withGuarantor)?.code).toBe('guarantor_consent_required');
    expect(evaluateSubmitGates({ ...withGuarantor, guarantorConsentCompleted: true })).toBeNull();
    expect(evaluateSubmitGates(input({ guarantorConsentCompleted: false }))).toBeNull();
  });
});

describe('assertSubmitGates', () => {
  it('throws a 409 with the gate code as message', () => {
    expect(() =>
      assertSubmitGates(input({ application: { ...input().application, consentsCompletedAt: null } })),
    ).toThrow(ConflictException);
    try {
      assertSubmitGates(input({ application: { ...input().application, consentsCompletedAt: null } }));
    } catch (error) {
      expect((error as ConflictException).getStatus()).toBe(409);
      expect((error as ConflictException).message).toBe('consents_required');
    }
  });

  it('carries the missing list on documents_missing', () => {
    try {
      assertSubmitGates(input({ documents: [] }));
      throw new Error('expected to throw');
    } catch (error) {
      const response = (error as ConflictException).getResponse() as { message: string; missing: string[] };
      expect(response.message).toBe('documents_missing');
      expect(response.missing).toEqual(['qid', 'passport', 'salary', 'bank']);
    }
  });

  it('carries the stale list on documents_stale', () => {
    try {
      assertSubmitGates(
        input({
          documents: input().documents.map((doc) =>
            doc.category === 'bank' ? { ...doc, createdAt: new Date('2026-06-01T00:00:00.000Z') } : doc,
          ),
        }),
      );
      throw new Error('expected to throw');
    } catch (error) {
      expect((error as ConflictException).getStatus()).toBe(409);
      const response = (error as ConflictException).getResponse() as { message: string; stale: string[] };
      expect(response.message).toBe('documents_stale');
      expect(response.stale).toEqual(['bank']);
    }
  });
});

describe('helpers', () => {
  it('identityHoldActive is true only for an uncleared hold', () => {
    expect(identityHoldActive({ identityHoldAt: null, identityHoldClearedAt: null })).toBe(false);
    expect(identityHoldActive({ identityHoldAt: NOW, identityHoldClearedAt: null })).toBe(true);
    expect(identityHoldActive({ identityHoldAt: NOW, identityHoldClearedAt: NOW })).toBe(false);
  });

  it('vehicleIdentityComplete needs all three identifiers non-blank', () => {
    expect(vehicleIdentityComplete({ vin: 'V', chassisNumber: 'C', engineNumber: 'E' })).toBe(true);
    expect(vehicleIdentityComplete({ vin: 'V', chassisNumber: 'C', engineNumber: '  ' })).toBe(false);
    expect(vehicleIdentityComplete({ vin: 'V', chassisNumber: null, engineNumber: 'E' })).toBe(false);
  });

  it('fails documents_missing with qid when e-KYC is required and the QID was hand-uploaded by the customer', () => {
    const failure = evaluateSubmitGates(
      input({
        documents: [
          { category: 'qid', uploadedByRole: 'customer' },
          { category: 'passport' },
          { category: 'salary' },
          { category: 'bank' },
        ],
        identityPolicy: { ekycRequired: true },
      }),
    );
    expect(failure).toEqual({ code: 'documents_missing', missing: ['qid'] });
  });

  it('passes under e-KYC when the identity came from the KYC platform', () => {
    expect(
      evaluateSubmitGates(
        input({
          documents: [
            { category: 'qid', kycDocumentType: 'qid_front', verificationStatus: 'verified', uploadedByRole: 'customer' },
            { category: 'passport' },
            { category: 'salary' },
            { category: 'bank' },
          ],
          identityPolicy: { ekycRequired: true, allowStaffManualIdentity: false },
        }),
      ),
    ).toBeNull();
  });
});
