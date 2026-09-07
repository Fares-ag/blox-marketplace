import { describe, expect, it } from 'vitest';
import { buildPricingSnapshot } from '@drivemarket/shared/pricing';
import { findForbiddenTerms } from '@drivemarket/shared/domain-rules';
import {
  NO_LATE_CHARGES_LINE,
  QATAR_CONSUMER_CREDIT_DISCLOSURES,
  QATAR_FINANCING_DISCLOSURES,
} from './contract-disclosures';
import {
  buildContractAmortizationSchedule,
  buildContractLines,
  buildContractPdf,
  contractTextFor,
  contractTrailerLines,
} from './contract-pdf';

/**
 * The contract describes a Diminishing Musharakah: rent and profit on the
 * co-owner share, never interest, APR, cost of credit or late charges. The
 * text is rendered exactly as the PDF prints it (see contract-pdf.spec.ts)
 * and scanned with the shared terminology guard.
 */
describe('contract terminology', () => {
  const pricing = buildPricingSnapshot({
    listPrice: 100_000,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: 12,
    downPaymentPct: 10,
  });
  const approvedAt = new Date('2026-08-20T10:00:00.000Z');
  const schedule = buildContractAmortizationSchedule(pricing, approvedAt);
  const input = {
    applicationId: 'app_terms_1',
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

  it('renders the full PDF text free of forbidden terms', () => {
    const text = contractTextFor(input);
    expect(text.length).toBeGreaterThan(500);
    expect(findForbiddenTerms(text)).toEqual([]);
  });

  it('keeps the disclosures free of forbidden terms', () => {
    expect(findForbiddenTerms(QATAR_FINANCING_DISCLOSURES.join('\n'))).toEqual([]);
    expect(QATAR_CONSUMER_CREDIT_DISCLOSURES).toBe(QATAR_FINANCING_DISCLOSURES);
  });

  it('labels the rate, the schedule column and the totals as rent / profit', () => {
    const text = contractTextFor(input);
    expect(text).toContain('Annual profit rate: 12.50%');
    expect(text).toContain('Monthly rent (profit)');
    expect(text).toContain('Total rent payable');
    expect(text).not.toMatch(/cost of credit/i);
    expect(text).not.toMatch(/\bAPR\b/);
    expect(text).not.toMatch(/interest/i);
    expect(text).not.toMatch(/late (fee|charge)/i);
  });

  it('states the no-late-charge policy exactly once', () => {
    const text = contractTextFor(input);
    expect(text.split(NO_LATE_CHARGES_LINE)).toHaveLength(2);
    expect(findForbiddenTerms(NO_LATE_CHARGES_LINE)).toEqual([]);
  });

  it('prints every body line into the PDF and keeps the fingerprint deterministic', async () => {
    const lines = buildContractLines(input);
    expect(lines.filter((line) => line.text).length).toBeGreaterThan(20);
    const { buffer, contentSha256 } = await buildContractPdf(input);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(contractTrailerLines(contentSha256)[0]).toContain(contentSha256);
    expect(contractTextFor(input)).toContain(contentSha256);
  });
});
