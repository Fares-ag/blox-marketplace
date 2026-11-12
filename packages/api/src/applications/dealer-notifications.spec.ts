import { ApplicationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { dealerStatusNotice, dealerStatusNoticeSkipped } from './dealer-notifications';

const parties = { customer: 'Sara Ali', dealer: 'Chery Elite Motors', ref: 'BLOX-0017' };

describe('dealerStatusNotice', () => {
  it('tells the dealer what to fix on resubmission', () => {
    expect(dealerStatusNotice('resubmission_required', parties, { reason: ' Upload a recent salary certificate ' })).toEqual({
      title: 'Resubmission needed — BLOX-0017',
      body: 'Sara Ali at Chery Elite Motors (BLOX-0017) was sent back for updates. Open the application to see what to correct. Upload a recent salary certificate',
    });
  });

  it('keeps the rejection reason so the dealer can explain it to the customer', () => {
    expect(dealerStatusNotice('rejected', parties, { reason: 'DBR above cap' }).body).toContain('DBR above cap');
  });

  it('distinguishes first contract generation from a re-sign request', () => {
    expect(
      dealerStatusNotice('contract_signing_required', parties, { fromStatus: ApplicationStatus.under_review }).title,
    ).toBe('Contract ready to sign — BLOX-0017');
    expect(dealerStatusNotice('contract_signing_required', parties, { fromStatus: ApplicationStatus.contracts_submitted }).title).toBe(
      'Contract needs re-signing — BLOX-0017',
    );
  });

  it('names activation and does not skip it', () => {
    expect(dealerStatusNoticeSkipped('active')).toBe(false);
    expect(dealerStatusNotice('active', parties)).toEqual({
      title: 'Financing activated — BLOX-0017',
      body: 'Sara Ali at Chery Elite Motors (BLOX-0017) is now active.',
    });
  });

  it('skips draft and partner_processing so walk-in create does not mail the dealer their own submit', () => {
    expect(dealerStatusNoticeSkipped('draft')).toBe(true);
    expect(dealerStatusNoticeSkipped('partner_processing')).toBe(true);
  });
});
