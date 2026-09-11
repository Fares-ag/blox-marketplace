import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUSES,
  BLOCKING_APPLICATION_STATUSES,
  canonicalStatusFromLegacy,
  customerPhaseFor,
  TERMINAL_APPLICATION_STATUSES,
} from './application-status-map';

describe('application-status-map', () => {
  it('maps every canonical status to a customer phase', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(customerPhaseFor(status)).toBeTruthy();
    }
  });

  it('follows the musharakah diagram order', () => {
    expect(customerPhaseFor('draft')).toBe('apply');
    expect(customerPhaseFor('under_review')).toBe('vetting');
    expect(customerPhaseFor('contract_signing_required')).toBe('contract');
    expect(customerPhaseFor('down_payment_required')).toBe('pre_disbursal');
    expect(customerPhaseFor('lpo_issued')).toBe('lpo');
    expect(customerPhaseFor('acquisition_pending')).toBe('acquisition');
    expect(customerPhaseFor('active')).toBe('rental');
    expect(customerPhaseFor('completed')).toBe('exit');
  });

  it('collapses phantom app statuses onto real API values', () => {
    expect(canonicalStatusFromLegacy('approved')).toBe('contract_signing_required');
    expect(canonicalStatusFromLegacy('pre_disbursal_pending')).toBe('down_payment_required');
  });

  it('keeps terminal statuses non-blocking', () => {
    for (const status of TERMINAL_APPLICATION_STATUSES) {
      expect(BLOCKING_APPLICATION_STATUSES).not.toContain(status);
    }
  });
});
