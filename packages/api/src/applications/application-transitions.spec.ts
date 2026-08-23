import { describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import {
  assertOpsTransitionAllowed,
  findTransitionRule,
  opsTransitionRequiresReason,
} from './application-transitions';

describe('application-transitions', () => {
  it('allows credit to reject from under_review', () => {
    expect(() =>
      assertOpsTransitionAllowed('under_review', 'rejected', UserRole.credit_officer),
    ).not.toThrow();
  });

  it('requires reason for reject', () => {
    expect(opsTransitionRequiresReason('under_review', 'rejected')).toBe(true);
  });

  it('allows contract review progression', () => {
    expect(findTransitionRule('contracts_submitted', 'contract_under_review')).toBeDefined();
    expect(findTransitionRule('contract_under_review', 'pending_finance_activation')).toBeDefined();
  });

  it('forbids finance officer on ops transitions', () => {
    expect(() =>
      assertOpsTransitionAllowed('under_review', 'rejected', UserRole.finance_officer),
    ).toThrow('invalid_status_transition');
  });

  it('forbids customer on ops transitions', () => {
    expect(() =>
      assertOpsTransitionAllowed('contracts_submitted', 'contract_under_review', UserRole.customer),
    ).toThrow('invalid_status_transition');
  });

  it('allows the down-payment collection path', () => {
    expect(() =>
      assertOpsTransitionAllowed('contract_under_review', 'down_payment_required', UserRole.credit_officer),
    ).not.toThrow();
    expect(findTransitionRule('down_payment_required', 'down_payment_submitted')).toBeDefined();
    expect(() =>
      assertOpsTransitionAllowed('down_payment_required', 'down_payment_submitted', UserRole.finance_officer),
    ).toThrow('invalid_status_transition');
    expect(() =>
      assertOpsTransitionAllowed('down_payment_submitted', 'pending_finance_activation', UserRole.finance_officer),
    ).not.toThrow();
  });

  it('keeps the direct no-down-payment edge valid', () => {
    expect(() =>
      assertOpsTransitionAllowed('contract_under_review', 'pending_finance_activation', UserRole.credit_officer),
    ).not.toThrow();
  });

  it('still forbids finance officer outside down-payment edges', () => {
    expect(() =>
      assertOpsTransitionAllowed('contracts_submitted', 'contract_under_review', UserRole.finance_officer),
    ).toThrow('invalid_status_transition');
  });

  it('allows dealer to submit a draft', () => {
    expect(() =>
      assertOpsTransitionAllowed('draft', 'under_review', UserRole.dealer_agent),
    ).not.toThrow();
  });

  it('allows credit to reopen a rejected application', () => {
    expect(() =>
      assertOpsTransitionAllowed('rejected', 'under_review', UserRole.credit_officer),
    ).not.toThrow();
  });

  it('allows admin to complete an active application', () => {
    expect(() =>
      assertOpsTransitionAllowed('active', 'completed', UserRole.admin),
    ).not.toThrow();
  });

  it('forbids finance from completing or activating via transition', () => {
    expect(() =>
      assertOpsTransitionAllowed('active', 'completed', UserRole.finance_officer),
    ).toThrow('invalid_status_transition');
    expect(() =>
      assertOpsTransitionAllowed('pending_finance_activation', 'active', UserRole.finance_officer),
    ).toThrow();
  });
});
