import { describe, expect, it } from 'vitest';
import { ApplicationStatus, UserRole } from '@prisma/client';
import {
  ACTIVATE_FROM_STATUSES,
  ADMIN_ACTIVATE_FROM_STATUSES,
  allowedTargets,
  assertOpsTransitionAllowed,
  findTransitionRule,
  opsTransitionRequiresReason,
  type TransitionActor,
} from './application-transitions';

const ALL: ApplicationStatus[] = Object.values(ApplicationStatus);
const ACTORS: TransitionActor[] = ['customer', 'credit', 'finance', 'admin', 'dealer'];

describe('application-transitions', () => {
  it('allows credit to reject from under_review with a reason', () => {
    expect(() =>
      assertOpsTransitionAllowed('under_review', 'rejected', UserRole.credit_officer),
    ).not.toThrow();
    expect(opsTransitionRequiresReason('under_review', 'rejected')).toBe(true);
  });

  it('exposes the spine edge under_review → pending_finance_activation (Approve for Finance)', () => {
    for (const role of [UserRole.credit_officer, UserRole.finance_officer, UserRole.admin]) {
      expect(() =>
        assertOpsTransitionAllowed('under_review', 'pending_finance_activation', role),
      ).not.toThrow();
    }
    expect(() =>
      assertOpsTransitionAllowed('under_review', 'pending_finance_activation', UserRole.dealer_agent),
    ).toThrow('invalid_status_transition');
  });

  it('gives finance credit parity on every review edge', () => {
    for (const from of ALL) {
      expect(allowedTargets(from, 'finance')).toEqual(allowedTargets(from, 'credit'));
    }
  });

  it('never exposes → active as a generic transition (activation is a dedicated endpoint)', () => {
    for (const actor of ACTORS) {
      for (const from of ALL) {
        expect(allowedTargets(from, actor)).not.toContain('active');
      }
    }
  });

  it('allows contract review progression', () => {
    expect(findTransitionRule('contracts_submitted', 'contract_under_review')).toBeDefined();
    expect(findTransitionRule('contract_under_review', 'pending_finance_activation')).toBeDefined();
    expect(findTransitionRule('contracts_submitted', 'pending_finance_activation')).toBeDefined();
  });

  it('allows resubmission from contract_signing_required (was a broken UI button)', () => {
    expect(() =>
      assertOpsTransitionAllowed('contract_signing_required', 'resubmission_required', UserRole.credit_officer),
    ).not.toThrow();
    expect(opsTransitionRequiresReason('contract_signing_required', 'resubmission_required')).toBe(true);
  });

  it('allows reject and reopen from pending_finance_activation', () => {
    expect(() =>
      assertOpsTransitionAllowed('pending_finance_activation', 'rejected', UserRole.finance_officer),
    ).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('pending_finance_activation', 'under_review', UserRole.credit_officer),
    ).not.toThrow();
  });

  it('keeps the down-payment recovery loop', () => {
    expect(findTransitionRule('pending_finance_activation', 'down_payment_required')).toBeDefined();
    expect(findTransitionRule('contract_under_review', 'down_payment_required')).toBeDefined();
    expect(findTransitionRule('down_payment_required', 'down_payment_submitted')).toBeDefined();
    expect(findTransitionRule('down_payment_submitted', 'pending_finance_activation')).toBeDefined();
  });

  it('lets ops cancel from review and admin cancel late', () => {
    expect(() =>
      assertOpsTransitionAllowed('under_review', 'submission_cancelled', UserRole.finance_officer),
    ).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('pending_finance_activation', 'submission_cancelled', UserRole.credit_officer),
    ).toThrow('invalid_status_transition');
    expect(() =>
      assertOpsTransitionAllowed('pending_finance_activation', 'submission_cancelled', UserRole.admin),
    ).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('active', 'submission_cancelled', UserRole.super_admin),
    ).not.toThrow();
  });

  it('reopens rejected for decision roles and cancelled for admin only', () => {
    expect(() =>
      assertOpsTransitionAllowed('rejected', 'under_review', UserRole.finance_officer),
    ).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('submission_cancelled', 'under_review', UserRole.admin),
    ).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('submission_cancelled', 'under_review', UserRole.credit_officer),
    ).toThrow('invalid_status_transition');
  });

  it('keeps dealers on intake edges only', () => {
    expect(allowedTargets('draft', 'dealer').sort()).toEqual(
      ['partner_processing', 'submission_cancelled', 'under_review'].sort(),
    );
    expect(allowedTargets('resubmission_required', 'dealer').sort()).toEqual(
      ['partner_processing', 'under_review'].sort(),
    );
    expect(allowedTargets('under_review', 'dealer')).toEqual([]);
  });

  it('forbids customer on ops transitions', () => {
    expect(() =>
      assertOpsTransitionAllowed('contracts_submitted', 'contract_under_review', UserRole.customer),
    ).toThrow('invalid_status_transition');
  });

  it('allows admin to complete an active application', () => {
    expect(() => assertOpsTransitionAllowed('active', 'completed', UserRole.admin)).not.toThrow();
    expect(() =>
      assertOpsTransitionAllowed('active', 'completed', UserRole.finance_officer),
    ).toThrow('invalid_status_transition');
  });

  it('publishes the activation entry points used by activate()', () => {
    expect(ACTIVATE_FROM_STATUSES).toEqual([
      'contracts_submitted',
      'contract_under_review',
      'down_payment_submitted',
      'pending_finance_activation',
    ]);
    expect(ADMIN_ACTIVATE_FROM_STATUSES).toEqual(['draft', 'under_review']);
  });
});
