import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  assertActorNotCreditApprover,
  assertDualControlWaive,
  assertSeparationOfDutiesForApplication,
  findCreditApproverId,
  isCreditApprovalLog,
  resolveCreditApproverId,
  separationOfDutiesEnabled,
  violatesSeparationOfDuties,
  type ActivityLogEntry,
} from './separation-of-duties';

const creditOfficer = 'credit-officer-1';
const financeOfficer = 'finance-officer-1';
const admin = 'admin-1';

function log(partial: Partial<ActivityLogEntry> & Pick<ActivityLogEntry, 'action'>): ActivityLogEntry {
  return {
    actorUserId: creditOfficer,
    fromValue: null,
    toValue: null,
    ...partial,
  };
}

describe('separation-of-duties', () => {
  describe('separationOfDutiesEnabled', () => {
    it('defaults to enabled when env unset', () => {
      expect(separationOfDutiesEnabled({ envValue: undefined })).toBe(true);
    });

    it('disables when env is false or 0', () => {
      expect(separationOfDutiesEnabled({ envValue: 'false' })).toBe(false);
      expect(separationOfDutiesEnabled({ envValue: '0' })).toBe(false);
    });

    it('respects company flag when global is enabled', () => {
      expect(separationOfDutiesEnabled({ envValue: 'true', companyFlag: false })).toBe(false);
      expect(separationOfDutiesEnabled({ envValue: 'true', companyFlag: true })).toBe(true);
    });
  });

  describe('isCreditApprovalLog', () => {
    it('recognizes contract_signing_required transition', () => {
      expect(
        isCreditApprovalLog(
          log({ action: 'status_transition', fromValue: 'under_review', toValue: 'contract_signing_required' }),
        ),
      ).toBe(true);
    });

    it('recognizes pending_finance_activation transition', () => {
      expect(
        isCreditApprovalLog(
          log({
            action: 'status_transition',
            fromValue: 'contract_under_review',
            toValue: 'pending_finance_activation',
          }),
        ),
      ).toBe(true);
    });

    it('recognizes direct activate from under_review', () => {
      expect(
        isCreditApprovalLog(
          log({
            action: 'status_transition',
            fromValue: 'under_review',
            toValue: 'active',
            metadata: { direct: true },
          }),
        ),
      ).toBe(true);
    });

    it('ignores non-approval transitions', () => {
      expect(
        isCreditApprovalLog(
          log({ action: 'status_transition', fromValue: 'active', toValue: 'completed' }),
        ),
      ).toBe(false);
      expect(isCreditApprovalLog(log({ action: 'down_payment_recorded', toValue: 'down_payment_submitted' }))).toBe(
        false,
      );
    });
  });

  describe('findCreditApproverId', () => {
    it('returns the most recent credit approver', () => {
      const logs: ActivityLogEntry[] = [
        log({
          action: 'status_transition',
          actorUserId: 'first-approver',
          fromValue: 'under_review',
          toValue: 'contract_signing_required',
        }),
        log({
          action: 'status_transition',
          actorUserId: creditOfficer,
          fromValue: 'contract_under_review',
          toValue: 'pending_finance_activation',
        }),
      ];
      expect(findCreditApproverId(logs)).toBe(creditOfficer);
    });

    it('returns null when no approval logs exist', () => {
      expect(findCreditApproverId([])).toBeNull();
    });
  });

  describe('violatesSeparationOfDuties', () => {
    it('flags same actor as credit approver', () => {
      expect(violatesSeparationOfDuties(creditOfficer, creditOfficer)).toBe(true);
    });

    it('allows different actors', () => {
      expect(violatesSeparationOfDuties(financeOfficer, creditOfficer)).toBe(false);
    });

    it('allows when no credit approver recorded', () => {
      expect(violatesSeparationOfDuties(admin, null)).toBe(false);
    });
  });

  describe('assertActorNotCreditApprover', () => {
    it('throws separation_of_duties for credit approver activating', () => {
      expect(() => assertActorNotCreditApprover(creditOfficer, creditOfficer)).toThrow(ForbiddenException);
      expect(() => assertActorNotCreditApprover(creditOfficer, creditOfficer)).toThrow(/separation_of_duties/);
    });

    it('allows finance officer after credit approval', () => {
      expect(() => assertActorNotCreditApprover(financeOfficer, creditOfficer)).not.toThrow();
    });
  });

  describe('assertDualControlWaive', () => {
    it('requires a prior waive request', () => {
      expect(() => assertDualControlWaive(admin, null)).toThrow(/waive_not_requested/);
    });

    it('blocks same actor confirming their own waive request', () => {
      expect(() => assertDualControlWaive(admin, admin)).toThrow(/dual_control_required/);
    });

    it('allows different actors', () => {
      expect(() => assertDualControlWaive('admin-2', admin)).not.toThrow();
    });
  });

  describe('resolveCreditApproverId', () => {
    it('queries application status_transition logs', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          actorUserId: creditOfficer,
          action: 'status_transition',
          fromValue: 'under_review',
          toValue: 'contract_signing_required',
          metadata: null,
          createdAt: new Date(),
        },
      ]);
      const prisma = { activityLog: { findMany } };

      await expect(resolveCreditApproverId(prisma, 'app-1')).resolves.toBe(creditOfficer);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'application', entityId: 'app-1', action: 'status_transition' },
        }),
      );
    });
  });

  describe('assertSeparationOfDutiesForApplication', () => {
    it('skips check when disabled', async () => {
      const findMany = vi.fn();
      const prisma = { activityLog: { findMany } };
      await assertSeparationOfDutiesForApplication(prisma, creditOfficer, 'app-1', false);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('throws when actor is credit approver on activate', async () => {
      const prisma = {
        activityLog: {
          findMany: vi.fn().mockResolvedValue([
            {
              actorUserId: creditOfficer,
              action: 'status_transition',
              fromValue: 'under_review',
              toValue: 'contract_signing_required',
              metadata: null,
              createdAt: new Date(),
            },
          ]),
        },
      };
      await expect(
        assertSeparationOfDutiesForApplication(prisma, creditOfficer, 'app-1', true),
      ).rejects.toMatchObject({ message: 'separation_of_duties' });
    });

    it('allows payment recording by a different officer', async () => {
      const prisma = {
        activityLog: {
          findMany: vi.fn().mockResolvedValue([
            {
              actorUserId: creditOfficer,
              action: 'status_transition',
              fromValue: 'contract_under_review',
              toValue: 'pending_finance_activation',
              metadata: null,
              createdAt: new Date(),
            },
          ]),
        },
      };
      await expect(
        assertSeparationOfDutiesForApplication(prisma, financeOfficer, 'app-1', true),
      ).resolves.toBeUndefined();
    });
  });
});
