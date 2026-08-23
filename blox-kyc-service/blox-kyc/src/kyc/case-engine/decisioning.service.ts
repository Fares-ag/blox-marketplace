import { Injectable } from '@nestjs/common';
import { KycCaseStatus, KycCheckStatus, KycCheckType } from '@prisma/client';
import { V1_REQUIRED_CHECKS } from '../checks/check.types';

export interface LatestCheck {
  type: KycCheckType;
  status: KycCheckStatus;
}

export interface DecisionOutcome {
  nextStatus: Extract<KycCaseStatus, 'approved' | 'needs_review' | 'step_up_required'>;
  reason: string;
  missing: KycCheckType[];
}

/**
 * Pure decision logic over the latest result per check. Kept side-effect-free
 * so it is trivially unit-testable. Rules (v1):
 *  - any check failed        -> needs_review (a human rejects/steps-up)
 *  - any check errored/pending-> needs_review
 *  - required check missing   -> step_up_required
 *  - any check manual_review  -> needs_review
 *  - all required passed      -> approved (auto)
 */
@Injectable()
export class DecisioningService {
  decide(required: readonly KycCheckType[], latest: LatestCheck[]): DecisionOutcome {
    const byType = new Map<KycCheckType, KycCheckStatus>();
    for (const c of latest) byType.set(c.type, c.status);

    const missing = required.filter((t) => !byType.has(t));
    if (missing.length > 0) {
      return { nextStatus: 'step_up_required', reason: 'missing_checks', missing };
    }

    const statuses = required.map((t) => byType.get(t)!);
    if (statuses.some((s) => s === 'failed' || s === 'error')) {
      return { nextStatus: 'needs_review', reason: 'check_failed_or_errored', missing: [] };
    }
    if (statuses.some((s) => s === 'manual_review' || s === 'pending')) {
      return { nextStatus: 'needs_review', reason: 'manual_review_required', missing: [] };
    }
    return { nextStatus: 'approved', reason: 'all_checks_passed', missing: [] };
  }

  requiredForV1(): readonly KycCheckType[] {
    return V1_REQUIRED_CHECKS;
  }
}
