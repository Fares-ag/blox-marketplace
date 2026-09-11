import { ApplicationStatus } from '@prisma/client';
import { BLOCKING_APPLICATION_STATUSES } from './application-access';
import { normalizePersonName } from './customer-snapshot';

/**
 * Duplicate handling for customer intake (LOS FSD §5.3):
 *
 *   1. An application already in flight (any product, any blocking status
 *      other than `draft`) refuses a new one — 409 `blocking_application`.
 *   2. A draft for the same product is resumed instead of duplicated.
 *   3. Otherwise a fresh draft is created (a draft on another vehicle does not
 *      block: the customer may simply have changed their mind).
 *
 * Identity-level de-duplication compares the blind index of the Qatar ID with
 * every other account and application carrying it; a different name or birth
 * year puts the new application on a MISMATCHED_IDENTITY hold for credit.
 *
 * Pure functions so the decisions are unit-testable without a database.
 */

/** Statuses that refuse a new application outright (drafts are resumable, not blocking). */
export const ACTIVE_BLOCKING_APPLICATION_STATUSES: ApplicationStatus[] = BLOCKING_APPLICATION_STATUSES.filter(
  (status) => status !== ApplicationStatus.draft,
);

export type DedupCandidate = {
  id: string;
  status: ApplicationStatus;
  productId: string;
  createdAt?: Date | null;
};

export type DedupDecision =
  | { kind: 'create' }
  | { kind: 'resume'; applicationId: string }
  | { kind: 'blocked'; applicationId: string; status: ApplicationStatus };

function newestFirst(a: DedupCandidate, b: DedupCandidate): number {
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

function isActivelyBlocking(candidate: DedupCandidate): boolean {
  return ACTIVE_BLOCKING_APPLICATION_STATUSES.includes(candidate.status);
}

/** Decide what `POST /applications` should do given the customer's existing applications. */
export function decideDuplicateApplication(existing: DedupCandidate[], productId: string): DedupDecision {
  const sorted = [...existing].sort(newestFirst);
  const blocked = sorted.find(isActivelyBlocking);
  if (blocked) return { kind: 'blocked', applicationId: blocked.id, status: blocked.status };
  const draft = sorted.find((a) => a.status === ApplicationStatus.draft && a.productId === productId);
  if (draft) return { kind: 'resume', applicationId: draft.id };
  return { kind: 'create' };
}

export type BlockingSummary = {
  blocking: boolean;
  applicationId: string | null;
  status: ApplicationStatus | null;
  /** Draft that `POST /applications` would resume (same product when one is given, else the newest draft). */
  draftApplicationId: string | null;
};

/** Truthful answer for `GET /applications/blocking`: mirrors `decideDuplicateApplication`. */
export function summarizeBlocking(existing: DedupCandidate[], productId?: string): BlockingSummary {
  const sorted = [...existing].sort(newestFirst);
  const blocked = sorted.find(isActivelyBlocking);
  const draft = sorted.find(
    (a) => a.status === ApplicationStatus.draft && (!productId || a.productId === productId),
  );
  return {
    blocking: !!blocked,
    applicationId: blocked?.id ?? null,
    status: blocked?.status ?? null,
    draftApplicationId: draft?.id ?? null,
  };
}

export const IDENTITY_HOLD_REASON = 'qid_identity_mismatch' as const;

export type IdentityCandidate = {
  userId: string | null;
  name?: string | null;
  birthYear?: number | null;
  source?: 'user' | 'application';
};

export type IdentityConflict = {
  userId: string;
  source: 'user' | 'application';
  nameMismatch: boolean;
  birthYearMismatch: boolean;
};

export type IdentityHoldDecision = {
  reason: typeof IDENTITY_HOLD_REASON;
  conflicts: IdentityConflict[];
} | null;

/**
 * The same QID on another account or application with a different (normalised)
 * name or birth year means the identity is contested. A match with the same
 * name and a compatible birth year is the same person (e.g. a walk-in account
 * later claimed online) and does not hold the application.
 */
export function decideIdentityHold(subject: IdentityCandidate, matches: IdentityCandidate[]): IdentityHoldDecision {
  const subjectName = normalizePersonName(subject.name);
  const conflicts: IdentityConflict[] = [];
  for (const match of matches) {
    if (subject.userId != null && match.userId === subject.userId) continue;
    const otherName = normalizePersonName(match.name);
    const nameMismatch = !!subjectName && !!otherName && subjectName !== otherName;
    const birthYearMismatch =
      subject.birthYear != null && match.birthYear != null && subject.birthYear !== match.birthYear;
    if (nameMismatch || birthYearMismatch) {
      conflicts.push({
        userId: match.userId ?? 'unknown',
        source: match.source ?? 'user',
        nameMismatch,
        birthYearMismatch,
      });
    }
  }
  return conflicts.length > 0 ? { reason: IDENTITY_HOLD_REASON, conflicts } : null;
}
