import { ApplicationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { financingSource, submittedStatusForPartner } from './partner-finance';

describe('partner-finance', () => {
  it('routes zoho partners to partner_processing', () => {
    expect(submittedStatusForPartner('zoho')).toBe(ApplicationStatus.partner_processing);
    expect(financingSource('zoho')).toBe('partner');
  });

  it('routes blox finance to under_review', () => {
    expect(submittedStatusForPartner('none')).toBe(ApplicationStatus.under_review);
    expect(submittedStatusForPartner(null)).toBe(ApplicationStatus.under_review);
    expect(financingSource('none')).toBe('blox');
  });
});
