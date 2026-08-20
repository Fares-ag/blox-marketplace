import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPricingSnapshot } from '@drivemarket/shared/pricing';
import {
  buildContractAmortizationSchedule,
  buildContractPdf,
  hashContractContent,
  verifySignedContractReferencesOriginal,
} from './contract-pdf';

describe('contract-pdf', () => {
  const pricing = buildPricingSnapshot({
    listPrice: 100_000,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: 12,
    downPaymentPct: 10,
  });

  const approvedAt = new Date('2026-08-20T10:00:00.000Z');
  const schedule = buildContractAmortizationSchedule(pricing, approvedAt);

  const baseInput = {
    applicationId: 'app_test_123',
    approvedAt: approvedAt.toISOString(),
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    customerPhone: '+97450000000',
    customerQid: '12345678901',
    vehicleLabel: 'Toyota Camry 2024',
    dealerName: 'Blox Motors',
    listPrice: pricing.list_price,
    downPayment: pricing.down_payment,
    downPaymentPct: pricing.down_payment_pct,
    monthly: pricing.monthly,
    tenor: pricing.tenor,
    annualRate: pricing.rate,
    financedTotal: pricing.financed_total,
    lenderName: 'Blox Finance',
    schedule,
  };

  it('builds an amortization schedule that retires the financed principal', () => {
    expect(schedule).toHaveLength(12);
    expect(schedule.at(-1)?.balance).toBe(0);
    expect(schedule.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(
      pricing.list_price - pricing.down_payment,
      2,
    );
  });

  it('embeds a stable content fingerprint in the generated PDF', async () => {
    const first = await buildContractPdf(baseInput);
    const second = await buildContractPdf(baseInput);
    const loaded = await PDFDocument.load(first.buffer);

    expect(first.contentSha256).toHaveLength(64);
    expect(first.contentSha256).toBe(second.contentSha256);
    expect(loaded.getSubject()).toBe(first.contentSha256);
    expect(loaded.getKeywords()).toContain(baseInput.applicationId);
    expect(loaded.getKeywords()).toContain(first.contentSha256);
  });

  it('changes the fingerprint when pricing terms change', () => {
    const altered = hashContractContent({
      ...baseInput,
      financedTotal: baseInput.financedTotal + 1,
    });
    expect(altered).not.toBe(hashContractContent(baseInput));
  });

  it('verifies signed uploads that still carry the original fingerprint metadata', async () => {
    const { buffer, contentSha256 } = await buildContractPdf(baseInput);
    const signedDoc = await PDFDocument.load(buffer);
    signedDoc.setTitle('Signed financing contract');
    const signed = Buffer.from(await signedDoc.save());

    expect(
      await verifySignedContractReferencesOriginal(signed, contentSha256, baseInput.applicationId),
    ).toBe(true);
    expect(
      await verifySignedContractReferencesOriginal(
        Buffer.from('unrelated pdf'),
        contentSha256,
        baseInput.applicationId,
      ),
    ).toBe(false);
  });
});
