import type { ApplicationStatus } from '@prisma/client';

/**
 * Z3: a `draft` application has not been submitted by the customer. Pushing it
 * to the partner CRM would create a lead (with KYC attachments) for an
 * application the customer may never submit, and which the partner would then
 * chase. Documents uploaded during `draft` are still synced later — the sync on
 * submit uploads every document attached to the application.
 *
 * `resubmission_required` DOES sync: the application was already submitted, the
 * partner already has the lead, and the newly uploaded documents are what they
 * are waiting for.
 */
export function shouldSyncStatusToCrm(status: ApplicationStatus): boolean {
  return status !== 'draft';
}
