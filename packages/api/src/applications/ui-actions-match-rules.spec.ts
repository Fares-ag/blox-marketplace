import { describe, expect, it } from 'vitest';
import { ApplicationStatus, UserRole } from '@prisma/client';
import {
  ACTIVATE_FROM_STATUSES,
  ADMIN_ACTIVATE_FROM_STATUSES,
  findTransitionRule,
  roleToActor,
} from './application-transitions';
import {
  visibleWorkspaceActions,
  type WorkspaceActions,
} from '../../../shared/src/ops-applications/useApplicationActions';

/**
 * Every button the shared workspace renders must map to an edge the API
 * accepts for that role — otherwise the UI shows actions that 400.
 */
const ROLES: UserRole[] = [
  UserRole.dealer_agent,
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];
const STATUSES = Object.values(ApplicationStatus);

/** action → target status for the generic /transition endpoint. */
const TRANSITION_ACTIONS: Partial<Record<keyof WorkspaceActions, ApplicationStatus | ((from: ApplicationStatus) => ApplicationStatus)>> = {
  approveForFinance: 'pending_finance_activation',
  reject: 'rejected',
  requestResubmission: 'resubmission_required',
  startContractReview: 'contract_under_review',
  approveSignedContract: 'pending_finance_activation',
  requireDownPayment: 'down_payment_required',
  recoverDownPayment: 'down_payment_required',
  reopen: 'under_review',
  cancel: 'submission_cancelled',
  submitToCredit: 'under_review',
};

function ruleAllows(from: ApplicationStatus, to: ApplicationStatus, role: UserRole) {
  const actor = roleToActor(role);
  const rule = findTransitionRule(from, to);
  return !!actor && !!rule && rule.actors.includes(actor);
}

describe('workspace actions ⊆ API transition rules', () => {
  for (const role of ROLES) {
    for (const status of STATUSES) {
      const actions = visibleWorkspaceActions(status, role);

      for (const [action, target] of Object.entries(TRANSITION_ACTIONS) as Array<
        [keyof WorkspaceActions, ApplicationStatus | ((s: ApplicationStatus) => ApplicationStatus)]
      >) {
        if (!actions[action]) continue;
        const to = typeof target === 'function' ? target(status) : target;
        it(`${role} @ ${status}: "${action}" → ${to} exists in RULES`, () => {
          expect(ruleAllows(status, to, role)).toBe(true);
        });
      }

      if (actions.approveContract) {
        it(`${role} @ ${status}: approve-contract only from under_review`, () => {
          expect(status).toBe('under_review');
          expect(role).not.toBe(UserRole.dealer_agent);
        });
      }
      if (actions.activate) {
        it(`${role} @ ${status}: activate matches ACTIVATE_FROM_STATUSES and excludes finance`, () => {
          expect(ACTIVATE_FROM_STATUSES).toContain(status);
          expect(role).not.toBe(UserRole.finance_officer);
        });
      }
      if (actions.activateAdmin) {
        it(`${role} @ ${status}: admin override matches ADMIN_ACTIVATE_FROM_STATUSES`, () => {
          expect(ADMIN_ACTIVATE_FROM_STATUSES).toContain(status);
          expect([UserRole.admin, UserRole.super_admin]).toContain(role);
        });
      }
      if (actions.recordDownPayment && status === 'down_payment_submitted') {
        it(`${role} @ down_payment_submitted: confirm down payment → pending_finance_activation`, () => {
          expect(ruleAllows(status, 'pending_finance_activation', role)).toBe(true);
        });
      }
    }
  }

  it('finance never sees an Activate control', () => {
    for (const status of STATUSES) {
      const a = visibleWorkspaceActions(status, UserRole.finance_officer);
      expect(a.activate).toBe(false);
      expect(a.directActivate).toBe(false);
      expect(a.activateAdmin).toBe(false);
    }
  });

  it('finance and credit see the same review decisions', () => {
    const decisionKeys: Array<keyof WorkspaceActions> = [
      'approveContract',
      'approveForFinance',
      'reject',
      'requestResubmission',
      'startContractReview',
      'approveSignedContract',
      'requireDownPayment',
      'recoverDownPayment',
      'recordDownPayment',
      'reopen',
      'cancel',
      'uploadSignedContract',
      'markInstallmentPaid',
    ];
    for (const status of STATUSES) {
      const c = visibleWorkspaceActions(status, UserRole.credit_officer);
      const f = visibleWorkspaceActions(status, UserRole.finance_officer);
      for (const k of decisionKeys) expect(f[k], `${k} @ ${status}`).toBe(c[k]);
    }
  });

  it('dealers only submit', () => {
    for (const status of STATUSES) {
      const d = visibleWorkspaceActions(status, UserRole.dealer_agent);
      expect(d.approveForFinance).toBe(false);
      expect(d.activate).toBe(false);
      expect(d.reject).toBe(false);
      expect(d.markInstallmentPaid).toBe(false);
    }
  });
});
