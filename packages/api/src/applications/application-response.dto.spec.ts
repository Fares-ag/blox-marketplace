import { describe, expect, it } from 'vitest';
import {
  daysToExpiry,
  mapApplicationDto,
  snapshotForAudience,
  toApplicationBlockingDto,
  toApplicationDto,
  toApplicationListItemDto,
  toDealerApplicationDto,
  toDealerApplicationListItemDto,
  toOpsApplicationDto,
  toOpsApplicationQueueItemDto,
  toTakafulPolicyDto,
} from './application-response.dto';
import { toPublicOfferDto } from '../common/offer-response.dto';

describe('application-response.dto', () => {
  const offer = {
    id: 'offer-1',
    name: 'Standard plan',
    annualRentRate: 12.5,
    profitRate: 3.5,
    tenureOptions: [12, 24, 36],
    minDownPaymentPct: 10,
    financePartnerId: 'fp-1',
    insuranceRateId: 'ins-1',
    companyId: 'co-1',
  };

  const snapshot = {
    full_name: 'Test User',
    phone: '+97455512345',
    qid: '28012345678',
    email: 'customer@example.com',
    applicantType: 'individual',
    guarantor: { fullName: 'Guarantor', qid: '28563412345', phone: '+97455598765', relationship: 'sibling' },
  };

  const takaful = {
    id: 'tk-1',
    applicationId: 'app-1',
    provider: 'Qatar Takaful',
    policyNumber: 'POL-1',
    coverageType: 'comprehensive',
    coverageAmount: 100_000,
    premiumAmount: 3_500.5,
    issuedAt: new Date('2026-01-01T00:00:00.000Z'),
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    riders: ['roadside', 'agency_repair'],
    status: 'active',
    declarationAcceptedAt: new Date('2026-01-01T09:00:00.000Z'),
    declarationVersion: 'takaful-2026-09-v1',
    documentPath: 'kyc/takaful/tk-1.pdf',
    verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
  };

  const app = {
    id: 'app-1',
    customerUserId: 'user-1',
    customerEmail: 'customer@example.com',
    customerSnapshot: snapshot,
    productId: 'prod-1',
    companyId: 'co-1',
    offerId: 'offer-1',
    financePartnerId: 'fp-1',
    financePartnerBranchId: 'fpb-1',
    branchId: 'br-1',
    leadSource: 'dealer_quote',
    zohoLeadId: 'zoho-123',
    zohoSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
    zohoSyncError: 'timeout',
    zohoSyncAttempts: 2,
    zohoNextRetryAt: new Date('2026-01-02T00:00:00.000Z'),
    pricingSnapshot: {
      list_price: 100_000,
      down_payment: 10_000,
      down_payment_pct: 10,
      tenor: 36,
      rate: 12.5,
      monthly: 3000,
      financed_total: 108_000,
      rule_flags: [{ code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 90_000 } }],
    },
    status: 'under_review' as const,
    contractGenerated: true,
    contractData: { secret: 'internal' },
    contractPdfPath: 'contracts/app-1.pdf',
    signedContractPath: 'contracts/app-1-signed.pdf',
    rejectionReason: null,
    resubmissionComment: null,
    statusReason: 'ops note',
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: null,
    completedAt: null,
    identityHoldReason: 'qid_identity_mismatch',
    identityHoldAt: new Date('2026-01-01T00:00:00.000Z'),
    identityHoldClearedAt: null,
    identityHoldClearedById: null,
    consentsCompletedAt: new Date('2026-01-01T01:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    product: {
      id: 'prod-1',
      slug: 'toyota-camry',
      make: 'Toyota',
      model: 'Camry',
      trim: null,
      modelYear: 2024,
      price: 100_000,
      vin: 'SECRETVIN123',
      chassisNumber: 'SECRETCHASSIS',
    },
    offer,
    company: { id: 'co-1', name: 'Dealer Co' },
    customer: { name: 'Test User', email: 'customer@example.com', phone: '+97455512345' },
    financePartner: { id: 'fp-1', name: 'Blox Finance', code: 'blox-finance', crmAdapter: 'none' },
    branch: { id: 'br-1', name: 'West Bay', code: 'WB' },
    takafulPolicies: [takaful],
    documents: [
      {
        id: 'doc-1',
        category: 'qid',
        mimeType: 'application/pdf',
        storagePath: 'kyc/secret.pdf',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    paymentSchedules: [
      {
        id: 'sched-1',
        sequence: 1,
        dueDate: new Date('2026-02-01T00:00:00.000Z'),
        amount: 3000,
        paidAmount: 0,
        remainingAmount: 3000,
        status: 'pending',
        paidAt: null,
      },
    ],
  };

  it('allow-lists public offer fields without profitRate in snake_case', () => {
    const dto = toPublicOfferDto(offer);
    expect(dto).toEqual({
      id: 'offer-1',
      name: 'Standard plan',
      annual_rent_rate: 12.5,
      tenure_options: [12, 24, 36],
      min_down_payment_pct: 10,
      finance_partner_id: 'fp-1',
      finance_partner_name: null,
      crm_adapter: null,
    });
    expect(dto).not.toHaveProperty('profitRate');
  });

  it('omits zoho, contract, vin, and document storage paths from customer DTO', () => {
    const dto = toApplicationDto(app);
    expect(dto).not.toHaveProperty('zohoLeadId');
    expect(dto).not.toHaveProperty('zoho_sync_error');
    expect(dto).not.toHaveProperty('contract_data');
    expect(dto).not.toHaveProperty('contract_pdf_path');
    expect(dto).not.toHaveProperty('signed_contract_path');
    expect(dto).not.toHaveProperty('status_reason');
    expect(dto.offer).not.toHaveProperty('profit_rate');
    expect(dto.product).not.toHaveProperty('vin');
    expect(dto.product).not.toHaveProperty('chassis_number');
    expect(dto.documents?.[0]).not.toHaveProperty('storage_path');
    expect(dto).toHaveProperty('customer_user_id', 'user-1');
    expect(dto).toHaveProperty('payment_schedules');
  });

  it('includes status_reason for ops DTO only', () => {
    const ops = toOpsApplicationDto(app);
    expect(ops.status_reason).toBe('ops note');
    expect(mapApplicationDto(app, 'ops').status_reason).toBe('ops note');
    expect(mapApplicationDto(app, 'customer').status_reason).toBeUndefined();
  });

  it('never gives the customer a decision reason — status only', () => {
    const declined = { ...app, status: 'rejected' as const, rejectionReason: 'DBR above cap', statusReason: 'DBR above cap' };
    const customer = mapApplicationDto(declined, 'customer') as Record<string, unknown>;
    expect(customer.status).toBe('rejected');
    expect(customer).not.toHaveProperty('rejection_reason');
    expect(customer).not.toHaveProperty('status_reason');
    expect(JSON.stringify(customer)).not.toContain('DBR above cap');
    // Instructions on what to fix are not decision reasons and still reach the customer.
    expect(mapApplicationDto({ ...declined, resubmissionComment: 'Upload a recent payslip' }, 'customer')).toMatchObject({
      resubmission_comment: 'Upload a recent payslip',
    });
    // Ops (and the dealer who originated the lead) keep the reason.
    expect(toOpsApplicationDto(declined).rejection_reason).toBe('DBR above cap');
    expect(toDealerApplicationDto(declined).rejection_reason).toBe('DBR above cap');
    expect(toApplicationListItemDto(declined)).not.toHaveProperty('rejection_reason');
    expect(toApplicationListItemDto(declined)).toMatchObject({ status: 'rejected' });
  });

  it('names who cleared the identity hold when the loader resolved it', () => {
    expect(toApplicationDto(app).identity_hold_cleared_by_name).toBeNull();
    const cleared = {
      ...app,
      identityHoldClearedAt: new Date('2026-01-03T00:00:00.000Z'),
      identityHoldClearedById: 'officer-1',
      identityHoldClearedByName: 'Credit Officer',
    };
    expect(toApplicationDto(cleared)).toMatchObject({
      identity_hold_cleared_at: cleared.identityHoldClearedAt,
      identity_hold_cleared_by_name: 'Credit Officer',
    });
    expect(toOpsApplicationDto(cleared).identity_hold_cleared_by_name).toBe('Credit Officer');
    expect(toOpsApplicationDto(cleared)).not.toHaveProperty('identity_hold_cleared_by_id');
  });

  it('gives the owner the full snapshot plus identity, consent, lender, branch and takaful facts', () => {
    const dto = toApplicationDto(app);
    expect(dto.customer_snapshot).toEqual(snapshot);
    expect(dto).toMatchObject({
      identity_hold_reason: 'qid_identity_mismatch',
      identity_hold_at: app.identityHoldAt,
      identity_hold_cleared_at: null,
      consents_completed_at: app.consentsCompletedAt,
      finance_partner_name: 'Blox Finance',
      branch_name: 'West Bay',
    });
    expect(dto).not.toHaveProperty('rule_flags');
    expect(dto).not.toHaveProperty('branch_id');
    expect(dto.takaful_policies).toHaveLength(1);
    expect(dto.takaful_policies?.[0]).toMatchObject({
      id: 'tk-1',
      application_id: 'app-1',
      coverage_type: 'comprehensive',
      coverage_amount: 100_000,
      premium_amount: 3_500.5,
      expires_at: '2026-12-31',
      riders: ['roadside', 'agency_repair'],
      has_document: true,
      status: 'active',
    });
  });

  it('masks the QID and phone for ops, guarantor included, and masks the customer phone', () => {
    const dto = toOpsApplicationDto(app);
    const masked = dto.customer_snapshot as Record<string, unknown>;
    expect(masked.qid).toBe('XXXXXXX5678');
    expect(masked.phone).toBe('+974 XXXX X345');
    expect(masked.full_name).toBe('Test User');
    expect((masked.guarantor as Record<string, unknown>).qid).toBe('XXXXXXX2345');
    expect((masked.guarantor as Record<string, unknown>).phone).toBe('+974 XXXX X765');
    expect(dto.customer?.phone).toBe('+974 XXXX X345');
    expect(dto).toMatchObject({
      identity_hold_reason: 'qid_identity_mismatch',
      consents_completed_at: app.consentsCompletedAt,
      finance_partner_id: 'fp-1',
      finance_partner_name: 'Blox Finance',
      finance_partner_branch_id: 'fpb-1',
      branch_id: 'br-1',
      branch_name: 'West Bay',
      rule_flags: [{ code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 90_000 } }],
    });
    // The stored snapshot is never mutated by masking.
    expect(snapshot.qid).toBe('28012345678');
  });

  it('lets dealer agents keep the phone but never the full QID', () => {
    const dto = toDealerApplicationDto(app);
    const masked = dto.customer_snapshot as Record<string, unknown>;
    expect(masked.phone).toBe('+97455512345');
    expect(masked.qid).toBe('XXXXXXX5678');
    expect((masked.guarantor as Record<string, unknown>).phone).toBe('+974 XXXX X765');
    expect(dto.customer?.phone).toBe('+97455512345');
    expect(dto).toMatchObject({ branch_id: 'br-1', rule_flags: expect.any(Array) });
    expect(dto).not.toHaveProperty('status_reason');
    expect(mapApplicationDto(app, 'dealer')).toEqual(dto);
  });

  it('snapshotForAudience handles non-object snapshots', () => {
    expect(snapshotForAudience(null, 'ops')).toBeNull();
    expect(snapshotForAudience('legacy', 'ops')).toBe('legacy');
    expect(snapshotForAudience(snapshot, 'customer')).toBe(snapshot);
  });

  it('masks the ops queue item and the dealer list item', () => {
    const queue = toOpsApplicationQueueItemDto({
      ...app,
      product: { make: 'Toyota', model: 'Camry', modelYear: 2024, slug: 'toyota-camry', price: 100_000 },
      company: { name: 'Dealer Co' },
      customer: { name: 'Test User', email: 'customer@example.com' },
      agent: null,
      paymentSchedules: [],
    });
    expect((queue.customer_snapshot as Record<string, unknown>).qid).toBe('XXXXXXX5678');
    expect((queue.customer_snapshot as Record<string, unknown>).phone).toBe('+974 XXXX X345');
    expect(queue).toMatchObject({
      identity_hold_reason: 'qid_identity_mismatch',
      consents_completed_at: app.consentsCompletedAt,
      finance_partner_id: 'fp-1',
      finance_partner_name: 'Blox Finance',
      branch_id: 'br-1',
      branch_name: 'West Bay',
      rule_flags: [{ code: 'financing_amount_exceeds_cap', params: { cap: 50_000, financed: 90_000 } }],
    });

    const dealer = toDealerApplicationListItemDto({
      ...app,
      product: { make: 'Toyota', model: 'Camry', modelYear: 2024, slug: 'toyota-camry' },
      agent: null,
    });
    expect((dealer.customer_snapshot as Record<string, unknown>).qid).toBe('XXXXXXX5678');
    expect((dealer.customer_snapshot as Record<string, unknown>).phone).toBe('+97455512345');
    expect(dealer.customer?.phone).toBe('+97455512345');
    expect(dealer).toMatchObject({ finance_partner_name: 'Blox Finance', branch_name: 'West Bay' });
  });

  it('maps takaful policies to the shared TakafulPolicyDto', () => {
    const now = new Date('2026-12-01T12:00:00.000Z');
    expect(toTakafulPolicyDto(takaful, now)).toEqual({
      id: 'tk-1',
      application_id: 'app-1',
      provider: 'Qatar Takaful',
      policy_number: 'POL-1',
      coverage_type: 'comprehensive',
      coverage_amount: 100_000,
      premium_amount: 3_500.5,
      issued_at: '2026-01-01',
      effective_from: '2026-01-01',
      expires_at: '2026-12-31',
      days_to_expiry: 30,
      riders: ['roadside', 'agency_repair'],
      status: 'active',
      declaration_accepted_at: '2026-01-01T09:00:00.000Z',
      declaration_version: 'takaful-2026-09-v1',
      has_document: true,
      verified_at: '2026-01-02T00:00:00.000Z',
      created_at: '2026-01-01T09:00:00.000Z',
    });
    expect(
      toTakafulPolicyDto(
        { ...takaful, coverageType: 'unknown', riders: null, documentPath: null, expiresAt: null },
        now,
      ),
    ).toMatchObject({ coverage_type: null, riders: [], has_document: false, days_to_expiry: null });
    expect(daysToExpiry(new Date('2026-11-30T00:00:00.000Z'), now)).toBe(-1);
  });

  it('exposes the blocking summary in snake_case', () => {
    expect(
      toApplicationBlockingDto({ blocking: true, applicationId: 'app-1', status: 'active', draftApplicationId: null }),
    ).toEqual({ blocking: true, application_id: 'app-1', status: 'active', draft_application_id: null });
    expect(toApplicationBlockingDto({ blocking: false, applicationId: null })).toEqual({
      blocking: false,
      application_id: null,
      status: null,
      draft_application_id: null,
    });
  });
});
