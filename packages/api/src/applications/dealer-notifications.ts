import { ApplicationStatus } from '@prisma/client';

export type DealerNoticeParties = {
  customer: string;
  dealer: string;
  ref: string | null;
};

/** Statuses that are not a credit/finance decision the dealer needs mailed. */
export function dealerStatusNoticeSkipped(toStatus: ApplicationStatus): boolean {
  return toStatus === ApplicationStatus.draft || toStatus === ApplicationStatus.partner_processing;
}

function titled(label: string, ref: string | null): string {
  return ref ? `${label} — ${ref}` : label;
}

function who(parties: DealerNoticeParties): string {
  return parties.ref ? `${parties.customer} at ${parties.dealer} (${parties.ref})` : `${parties.customer} at ${parties.dealer}`;
}

/**
 * Email copy for the assigned sales executive and sales managers when an
 * application changes status. Rejection/cancellation keep the ops reason —
 * the dealer is the one who has to explain it to the customer.
 */
export function dealerStatusNotice(
  toStatus: ApplicationStatus,
  parties: DealerNoticeParties,
  opts?: { fromStatus?: ApplicationStatus | null; reason?: string | null },
): { title: string; body: string } {
  const instruction = opts?.reason?.trim() ? ` ${opts.reason.trim()}` : '';
  const whoLine = who(parties);
  const from = opts?.fromStatus ?? null;

  switch (toStatus) {
    case ApplicationStatus.resubmission_required:
      return {
        title: titled('Resubmission needed', parties.ref),
        body: `${whoLine} was sent back for updates. Open the application to see what to correct.${instruction}`,
      };
    case ApplicationStatus.active:
      return {
        title: titled('Financing activated', parties.ref),
        body: `${whoLine} is now active.`,
      };
    case ApplicationStatus.rejected:
      return {
        title: titled('Application rejected', parties.ref),
        body: `${whoLine} was rejected.${instruction}`,
      };
    case ApplicationStatus.submission_cancelled:
      return {
        title: titled('Application cancelled', parties.ref),
        body: `${whoLine} was cancelled.${instruction}`,
      };
    case ApplicationStatus.contract_signing_required:
      return from === ApplicationStatus.under_review
        ? {
            title: titled('Contract ready to sign', parties.ref),
            body: `The contract for ${whoLine} is ready. The customer needs to sign.`,
          }
        : {
            title: titled('Contract needs re-signing', parties.ref),
            body: `The contract for ${whoLine} needs to be signed again.${instruction}`,
          };
    case ApplicationStatus.contracts_submitted:
      return {
        title: titled('Signed contract received', parties.ref),
        body: `A signed contract for ${whoLine} is now under review.`,
      };
    case ApplicationStatus.contract_under_review:
      return {
        title: titled('Contract under review', parties.ref),
        body: `The signed contract for ${whoLine} is under review.`,
      };
    case ApplicationStatus.pending_finance_activation:
      return {
        title: titled(
          from === ApplicationStatus.under_review || from === ApplicationStatus.draft
            ? 'Application approved'
            : 'Contract approved',
          parties.ref,
        ),
        body: `${whoLine} was approved and is waiting on finance activation.`,
      };
    case ApplicationStatus.down_payment_required:
      return {
        title: titled('Down payment required', parties.ref),
        body: `${whoLine} needs a down payment recorded before activation.`,
      };
    case ApplicationStatus.down_payment_submitted:
      return {
        title: titled('Down payment recorded', parties.ref),
        body: `A down payment for ${whoLine} was recorded and is pending confirmation.`,
      };
    case ApplicationStatus.lpo_issued:
      return {
        title: titled('Purchase order issued', parties.ref),
        body: `A purchase order was issued for ${whoLine}.`,
      };
    case ApplicationStatus.acquisition_pending:
      return {
        title: titled('Vehicle on order', parties.ref),
        body: `The purchase order for ${whoLine} is settled. Waiting on the vehicle.`,
      };
    case ApplicationStatus.under_review:
      return {
        title: titled('Application reopened', parties.ref),
        body: `${whoLine} is back in credit review.`,
      };
    case ApplicationStatus.completed:
      return {
        title: titled('Financing completed', parties.ref),
        body: `${whoLine} is complete.`,
      };
    default:
      return {
        title: titled('Application update', parties.ref),
        body: `${whoLine} is now ${toStatus.replace(/_/g, ' ')}.`,
      };
  }
}
