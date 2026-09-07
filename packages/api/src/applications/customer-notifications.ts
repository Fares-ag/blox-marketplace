import { ApplicationStatus } from '@prisma/client';

/**
 * Customers never receive a decision reason: the rejection (or cancellation)
 * notification names the outcome only — support handles the conversation.
 * Resubmission / re-signing requests keep the reason, because there it is the
 * instruction of what to fix, not a decision rationale.
 *
 * Pure so the rule is unit-tested without the lifecycle service.
 */
export const DECISION_STATUSES_WITHOUT_REASON: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  ApplicationStatus.rejected,
  ApplicationStatus.submission_cancelled,
]);

export function customerNotificationBody(toStatus: ApplicationStatus, reason?: string | null): string | undefined {
  if (DECISION_STATUSES_WITHOUT_REASON.has(toStatus)) return undefined;
  return reason?.trim() || undefined;
}
