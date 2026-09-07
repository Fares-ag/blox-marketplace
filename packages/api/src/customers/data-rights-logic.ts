import {
  ApplicationStatus,
  DataRightsRequestStatus,
  type DataRightsRequest,
} from '@prisma/client';
import type { DataRightsRequestDto } from '../../../shared/src/types/customer-platform';
import { BLOCKING_APPLICATION_STATUSES } from '../applications/application-access';

/**
 * Data-rights requests (Qatar Law No. 13 of 2016): access, correction,
 * deletion and consent withdrawal. Pure rules — deadlines, the status machine,
 * what deletion may not interrupt, and how a deleted customer is anonymised.
 */

/** Statutory response window. */
export const DATA_RIGHTS_SLA_DAYS = 30;

const DAY_MS = 86_400_000;

export function dataRightsDueAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + DATA_RIGHTS_SLA_DAYS * DAY_MS);
}

/** Financing the customer is still bound to — submitted and not yet closed. Drafts do not block deletion. */
export const DELETION_BLOCKING_STATUSES: ApplicationStatus[] = BLOCKING_APPLICATION_STATUSES.filter(
  (status) => status !== ApplicationStatus.draft,
);

export const PENDING_DATA_RIGHTS_STATUSES: DataRightsRequestStatus[] = [
  DataRightsRequestStatus.open,
  DataRightsRequestStatus.in_progress,
];

export const DATA_RIGHTS_TRANSITIONS: Record<DataRightsRequestStatus, readonly DataRightsRequestStatus[]> = {
  open: ['in_progress', 'completed', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

export function canTransitionDataRights(from: DataRightsRequestStatus, to: DataRightsRequestStatus): boolean {
  return DATA_RIGHTS_TRANSITIONS[from].includes(to);
}

export function isTerminalDataRightsStatus(status: DataRightsRequestStatus): boolean {
  return DATA_RIGHTS_TRANSITIONS[status].length === 0;
}

export const ANONYMISED_NAME = 'Deleted customer';

export function anonymisedEmail(userId: string): string {
  return `deleted-${userId}@anonymised.local`;
}

/**
 * Scalar columns rewritten when a deletion request completes. The QID columns
 * come from `IdentityService.prepareQidWrite(null)` and the JSON columns
 * (address, notification preferences) from `Prisma.DbNull` in the service.
 */
export function anonymisationPatch(userId: string) {
  return {
    name: ANONYMISED_NAME,
    email: anonymisedEmail(userId),
    emailVerified: false,
    image: null,
    phone: null,
    firstName: null,
    lastName: null,
    gender: null,
    dateOfBirth: null,
    nationality: null,
    isActive: false,
    twoFactorEnabled: false,
  };
}

export type DataRightsRow = DataRightsRequest & {
  handledBy?: { name: string | null } | null;
  user?: { id: string; name: string | null; email: string } | null;
};

export function toDataRightsRequestDto(
  row: DataRightsRow,
  opts: { includeCustomer?: boolean } = {},
): DataRightsRequestDto {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    details: row.details ?? null,
    consent_code: row.consentCode ?? null,
    resolution_note: row.resolutionNote ?? null,
    due_at: row.dueAt?.toISOString() ?? null,
    handled_at: row.handledAt?.toISOString() ?? null,
    handled_by_name: row.handledBy?.name ?? null,
    ...(opts.includeCustomer
      ? { customer: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null }
      : {}),
    created_at: row.createdAt.toISOString(),
  };
}
