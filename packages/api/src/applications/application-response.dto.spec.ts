import { describe, expect, it } from 'vitest';
import {
  mapApplicationDto,
  toApplicationDto,
  toOpsApplicationDto,
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

  const app = {
    id: 'app-1',
    customerUserId: 'user-1',
    customerEmail: 'customer@example.com',
    customerSnapshot: { full_name: 'Test User', phone: '+97450000000', qid: '28012345678' },
    productId: 'prod-1',
    companyId: 'co-1',
    offerId: 'offer-1',
    financePartnerId: 'fp-1',
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
    customer: { name: 'Test User', email: 'customer@example.com', phone: '+97450000000' },
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
});
