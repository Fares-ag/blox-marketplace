import { ApplicationStatus } from '@prisma/client';
import { BLOCKING_APPLICATION_STATUSES } from '../applications/application-access';

/**
 * Consent withdrawal rule (Qatar PDPPL right to withdraw consent).
 *
 * A consent can be withdrawn freely while it only backs drafts: the drafts lose
 * their `consentsCompletedAt` stamp and must re-consent before submitting. Once
 * an application that relied on the consent has been submitted and is still
 * live (under review, contracted, active…), the withdrawal cannot be applied
 * automatically — a data-rights request is opened for the privacy team instead.
 */

/** Live post-submission statuses: withdrawing a consent they rely on needs a human decision. */
export const WITHDRAWAL_BLOCKING_STATUSES: ApplicationStatus[] = BLOCKING_APPLICATION_STATUSES.filter(
  (status) => status !== ApplicationStatus.draft,
);

export type WithdrawalApplication = {
  id: string;
  status: ApplicationStatus;
  consentsCompletedAt: Date | null;
  /** Consent codes recorded directly against this application. */
  consentCodes: readonly string[];
};

/** An application carries a consent when all four were stamped on it or a record for that code is linked to it. */
export function applicationCarriesConsent(app: WithdrawalApplication, code: string): boolean {
  return app.consentsCompletedAt != null || app.consentCodes.includes(code);
}

export type WithdrawalDecision = {
  allowed: boolean;
  /** Live applications that rely on the consent (why the withdrawal is blocked). */
  blockingApplicationIds: string[];
  /** Drafts whose consent stamp must be cleared when the withdrawal goes through. */
  draftIdsToClear: string[];
};

export function consentWithdrawalDecision(code: string, applications: WithdrawalApplication[]): WithdrawalDecision {
  const carrying = applications.filter((app) => applicationCarriesConsent(app, code));
  const blockingApplicationIds = carrying
    .filter((app) => WITHDRAWAL_BLOCKING_STATUSES.includes(app.status))
    .map((app) => app.id);
  const draftIdsToClear = carrying
    .filter((app) => app.status === ApplicationStatus.draft)
    .map((app) => app.id);
  return { allowed: blockingApplicationIds.length === 0, blockingApplicationIds, draftIdsToClear };
}
